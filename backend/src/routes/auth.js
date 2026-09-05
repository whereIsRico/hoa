const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const Resident = require('../models/Resident');
const EmailVerification = require('../models/EmailVerification');
const Community = require('../models/Community');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sign } = require('../utils/jwt');
const { generateCode } = require('../utils/verificationCode');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
const { sendVerificationCode, sendAdminNotification, sendPasswordResetEmail } = require('../utils/email');
const {
  validateRegister, validateLogin, validateVerifyEmail, validateResendCode,
  validateForgotPassword, validateResetPassword,
} = require('../middleware/validate');

const router = express.Router();

function signToken(resident) {
  return sign({
    id: resident.id, community_id: resident.community_id, role: resident.role,
    actorType: 'resident', token_version: resident.token_version,
  });
}

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

const resendCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait before requesting another code.' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please wait before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait before trying again.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

router.post('/register', registerLimiter, validateRegister, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { community_id, email, password, first_name, last_name, phone, unit_number } = req.body;

    const exists = await Resident.emailExistsInCommunity(email, community_id);
    if (exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists for this community' });
    }

    // The community's configured monthly guest limit becomes this resident's
    // starting value — an admin can still override it per-resident later.
    const policy = await Policy.findByCommunity(community_id);

    const resident = await Resident.create({
      community_id, email, password, first_name, last_name, phone, unit_number,
      guest_limit_per_month: policy.max_guests_per_resident_per_month,
    }, client);

    const code = generateCode();
    await EmailVerification.create(resident.id, code, client);

    try {
      await sendVerificationCode(resident.email, code);
    } catch (sendErr) {
      // A resident should never end up in a state where an account exists
      // but no code was ever deliverable — roll the whole thing back.
      await client.query('ROLLBACK');
      return res.status(502).json({ error: 'Could not send verification email. Please try again.' });
    }

    await client.query('COMMIT');
    // No token here — this is the behavioral break from before: registration
    // no longer logs you in. The frontend routes to /verify-email next.
    res.status(201).json({ email: resident.email, community_id: resident.community_id });
  } catch (err) {
    await client.query('ROLLBACK');
    // FK violation on a bad community_id
    if (err.code === '23503') {
      return res.status(400).json({ error: 'community_id does not refer to an existing community' });
    }
    next(err);
  } finally {
    client.release();
  }
});

router.post('/verify-email', verifyEmailLimiter, validateVerifyEmail, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { community_id, email, code } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Resident not found' });
    }

    if (resident.email_verified) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email is already verified' });
    }

    const verification = await EmailVerification.findLatestForResident(resident.id, client);
    if (!verification || new Date(verification.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code expired or not found. Request a new one.' });
    }

    const matches = await EmailVerification.matchesCode(verification, code);
    if (!matches) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Incorrect code' });
    }

    const verifiedResident = await Resident.markEmailVerified(resident.id, client);
    await EmailVerification.remove(verification.id, client);

    await AuditLog.log(client, {
      community_id,
      action: 'resident.email_verified',
      actor_id: resident.id,
      actor_type: 'resident',
      resource_id: resident.id,
      resource_type: 'resident',
      details: { email: resident.email },
    });

    await client.query('COMMIT');

    // Best-effort from here — the resident already proved they own the
    // email, that's the part that must not roll back. A failed admin
    // notification is logged, not surfaced to the resident.
    try {
      const adminEmails = await Resident.listAdminEmailsForCommunity(community_id);
      const community = await Community.findById(community_id);
      await sendAdminNotification(adminEmails, {
        residentName: `${verifiedResident.first_name} ${verifiedResident.last_name}`,
        communityName: community?.name || 'their HOA',
      });
    } catch (notifyErr) {
      console.error('Admin notification failed:', notifyErr.message);
    }

    const token = signToken(verifiedResident);
    // token_version rides along on verifiedResident (Resident.markEmailVerified
    // returns it alongside PUBLIC_COLUMNS specifically so signToken has it),
    // but it's an internal field — strip it before sending the resident back.
    const { token_version, ...safeVerifiedResident } = verifiedResident;
    res.json({ resident: safeVerifiedResident, token });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/resend-code', resendCodeLimiter, validateResendCode, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (resident.email_verified) {
      return res.status(409).json({ error: 'Email is already verified' });
    }

    const code = generateCode();
    await EmailVerification.create(resident.id, code);

    try {
      await sendVerificationCode(resident.email, code);
    } catch (sendErr) {
      return res.status(502).json({ error: 'Could not send verification email. Please try again.' });
    }

    res.status(200).json({ email: resident.email, community_id: resident.community_id });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
  try {
    const { community_id, email, password } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await Resident.verifyPassword(password, resident.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Closes the obvious bypass: without this, a resident who never
    // completes verification could just log in directly instead.
    if (!resident.email_verified) {
      return res.status(403).json({ error: 'Email not verified', code: 'EMAIL_UNVERIFIED' });
    }

    const token = signToken(resident);
    const { password_hash, ...safeResident } = resident;

    res.json({ resident: safeResident, token });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (resident) {
      await PasswordResetToken.deleteForActor('resident', resident.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'resident',
        actor_id: resident.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/reset-password?token=${rawToken}`;
      // Fire-and-forget — the identical-response guarantee below is the
      // security-critical part (prevents email enumeration), and that
      // includes timing: awaiting this real network round-trip to Resend
      // would make the account-exists branch measurably slower than the
      // account-doesn't-exist branch, defeating the point of an identical
      // response body/status. Safe to not await here because this is a
      // long-lived Express process (DigitalOcean App Platform), not a
      // serverless function that could freeze mid-flight after the
      // response is sent — the promise below will actually complete.
      sendPasswordResetEmail(resident.email, resetUrl).catch((sendErr) => {
        console.error('Password reset email failed:', sendErr.message);
      });
    }

    // Always the same response whether or not the account exists —
    // prevents email enumeration, same reasoning as login's generic
    // "invalid email or password" for a nonexistent account.
    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

router.post('/reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'resident') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const resident = await Resident.updatePassword(tokenRow.actor_id, new_password, client);
    if (!resident) {
      // The resident was deleted after the token was issued but before it
      // was used. Indistinguishable from an invalid token to the caller —
      // not a different error, and definitely not a 500 or a fake success.
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    await Resident.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);

    await AuditLog.log(client, {
      community_id: resident.community_id,
      action: 'resident.password_reset',
      actor_id: resident.id,
      actor_type: 'resident',
      resource_id: resident.id,
      resource_type: 'resident',
      details: {},
    });

    await client.query('COMMIT');
    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
