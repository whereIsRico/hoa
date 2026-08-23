const { verifyFromHeader } = require('../utils/jwt');

function authenticateStaff(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  if (payload.actorType !== 'gate_staff') {
    return res.status(403).json({ error: 'Gate staff credentials required' });
  }

  req.staff = payload; // { id, community_id, actorType }
  next();
}

module.exports = authenticateStaff;
