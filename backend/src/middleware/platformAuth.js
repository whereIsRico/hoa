const { verifyFromHeader } = require('../utils/jwt');
const PlatformAdmin = require('../models/PlatformAdmin');

async function authenticatePlatform(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  if (payload.actorType !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin credentials required' });
  }

  try {
    // See middleware/auth.js for why this check exists.
    const currentVersion = await PlatformAdmin.getTokenVersion(payload.id);
    if (currentVersion === null || currentVersion !== payload.token_version) {
      return res.status(401).json({ error: 'Missing, invalid, or expired token' });
    }
  } catch (err) {
    return next(err);
  }

  req.platformAdmin = payload; // { id, actorType, token_version }
  next();
}

module.exports = authenticatePlatform;
