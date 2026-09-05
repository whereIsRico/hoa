const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const GateStaff = require('../models/GateStaff');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sign } = require('../utils/jwt');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
const { sendPasswordResetEmail } = require('../utils/email');
const { validateLogin, validateForgotPassword } = require('../middleware/validate');

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
      // Best-effort from here — the identical-response guarantee below is
      // the security-critical part (prevents email enumeration); a failed
      // send must not produce a different status than the "doesn't exist"
      // path. Same reasoning as auth.js's /verify-email admin notification.
      try {
        await sendPasswordResetEmail(staff.email, resetUrl);
      } catch (sendErr) {
        console.error('Password reset email failed:', sendErr.message);
      }
    }

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
