const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const PlatformAdmin = require('../models/PlatformAdmin');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sign } = require('../utils/jwt');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
const { sendPasswordResetEmail } = require('../utils/email');
const { validatePlatformLogin, validatePlatformForgotPassword, validateResetPassword } = require('../middleware/validate');

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
      // Fire-and-forget — the identical-response guarantee below is the
      // security-critical part (prevents email enumeration), and that
      // includes timing: awaiting this real network round-trip to Resend
      // would make the account-exists branch measurably slower than the
      // account-doesn't-exist branch, defeating the point of an identical
      // response body/status. Safe to not await here because this is a
      // long-lived Express process (DigitalOcean App Platform), not a
      // serverless function that could freeze mid-flight after the
      // response is sent — the promise below will actually complete.
      sendPasswordResetEmail(admin.email, resetUrl).catch((sendErr) => {
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

router.post('/platform-reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'platform_admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const admin = await PlatformAdmin.updatePassword(tokenRow.actor_id, new_password, client);
    if (!admin) {
      // The platform admin account was deleted after the token was issued
      // but before it was used. Indistinguishable from an invalid token to
      // the caller — not a different error, and definitely not a 500 or a
      // fake success (this branch previously never checked the return
      // value at all, so a null result would silently proceed to delete
      // the token and respond 200 having changed nothing).
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }
    await PlatformAdmin.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);
    // No audit_logs entry — community_id is NOT NULL there and a platform
    // admin's own account action has no community to attach to, same as
    // platform-admin login itself not being audit-logged.

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
