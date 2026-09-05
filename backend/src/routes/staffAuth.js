const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const GateStaff = require('../models/GateStaff');
const PasswordResetToken = require('../models/PasswordResetToken');
const AuditLog = require('../models/AuditLog');
const { sign } = require('../utils/jwt');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
const { sendPasswordResetEmail } = require('../utils/email');
const { validateLogin, validateForgotPassword, validateResetPassword } = require('../middleware/validate');

const router = express.Router();

const staffLoginLimiter = rateLimit({
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

router.post('/staff-login', staffLoginLimiter, validateLogin, async (req, res, next) => {
  try {
    const { community_id, email, password } = req.body;

    const staff = await GateStaff.findByEmailAndCommunity(email, community_id);
    // Inactive staff get the same generic error as "not found" — don't reveal
    // account status to an unauthenticated caller.
    if (!staff || !staff.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await GateStaff.verifyPassword(password, staff.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = sign({ id: staff.id, community_id: staff.community_id, actorType: 'gate_staff', token_version: staff.token_version });
    const { password_hash, ...safeStaff } = staff;

    res.json({ staff: safeStaff, token });
  } catch (err) {
    next(err);
  }
});

router.post('/staff-forgot-password', forgotPasswordLimiter, validateForgotPassword, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const staff = await GateStaff.findByEmailAndCommunity(email, community_id);
    if (staff && staff.is_active) {
      await PasswordResetToken.deleteForActor('gate_staff', staff.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'gate_staff',
        actor_id: staff.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/staff/reset-password?token=${rawToken}`;
      // Fire-and-forget — the identical-response guarantee below is the
      // security-critical part (prevents email enumeration), and that
      // includes timing: awaiting this real network round-trip to Resend
      // would make the account-exists branch measurably slower than the
      // account-doesn't-exist branch, defeating the point of an identical
      // response body/status. Safe to not await here because this is a
      // long-lived Express process (DigitalOcean App Platform), not a
      // serverless function that could freeze mid-flight after the
      // response is sent — the promise below will actually complete.
      sendPasswordResetEmail(staff.email, resetUrl).catch((sendErr) => {
        console.error('Password reset email failed:', sendErr.message);
      });
    }

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

router.post('/staff-reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'gate_staff') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const staff = await GateStaff.updatePassword(tokenRow.actor_id, new_password, client);
    if (!staff) {
      // The staff account was deleted after the token was issued but before
      // it was used. Indistinguishable from an invalid token to the caller —
      // not a different error, and definitely not a 500 or a fake success.
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    await GateStaff.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);

    await AuditLog.log(client, {
      community_id: staff.community_id,
      action: 'staff.password_reset',
      actor_id: staff.id,
      actor_type: 'gate_staff',
      resource_id: staff.id,
      resource_type: 'gate_staff',
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
