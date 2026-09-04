const express = require('express');
const rateLimit = require('express-rate-limit');

const PlatformAdmin = require('../models/PlatformAdmin');
const { sign } = require('../utils/jwt');
const { validatePlatformLogin } = require('../middleware/validate');

const router = express.Router();

const platformLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait before trying again.' },
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

module.exports = router;
