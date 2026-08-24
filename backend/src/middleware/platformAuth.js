const { verifyFromHeader } = require('../utils/jwt');

function authenticatePlatform(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  if (payload.actorType !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin credentials required' });
  }

  req.platformAdmin = payload; // { id, actorType }
  next();
}

module.exports = authenticatePlatform;
