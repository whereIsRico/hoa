const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const PlatformAdmin = require('../models/PlatformAdmin');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sign } = require('../utils/jwt');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
const { sendPasswordResetEmail } = require('../utils/email');
const { validatePlatformLogin, validatePlatformForgotPassword } = require('../middleware/validate');

const router = express.Router();

const platformLoginLimiter = rateLimit({
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

router.post('/platform-login', platformLoginLimiter, validatePlatformLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await PlatformAdmin.findByEmail(email);
    // Inactive accounts get the same generic error as "not found" — don't
    // reveal account status to an unauthenticated caller.
    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await PlatformAdmin.verifyPassword(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = sign({ id: admin.id, actorType: 'platform_admin', token_version: admin.token_version });
    const { password_hash, ...safeAdmin } = admin;

    res.json({ platformAdmin: safeAdmin, token });
  } catch (err) {
    next(err);
  }
});

router.post('/platform-forgot-password', forgotPasswordLimiter, validatePlatformForgotPassword, async (req, res, next) => {
  try {
    const { email } = req.body;

    const admin = await PlatformAdmin.findByEmail(email);
    if (admin && admin.is_active) {
      await PasswordResetToken.deleteForActor('platform_admin', admin.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'platform_admin',
        actor_id: admin.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/platform/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(admin.email, resetUrl);
    }

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
