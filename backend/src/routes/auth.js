const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const Resident = require('../models/Resident');
const EmailVerification = require('../models/EmailVerification');
const Community = require('../models/Community');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const { sign } = require('../utils/jwt');
const { generateCode } = require('../utils/verificationCode');
const { sendVerificationCode, sendAdminNotification } = require('../utils/email');
const {
  validateRegister, validateLogin, validateVerifyEmail, validateResendCode,
} = require('../middleware/validate');

const router = express.Router();

function signToken(resident) {
  return sign({ id: resident.id, community_id: resident.community_id, role: resident.role, actorType: 'resident' });
}

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

const resendCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait before requesting another code.' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please wait before trying again.' },
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

router.post('/login', validateLogin, async (req, res, next) => {
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

module.exports = router;
