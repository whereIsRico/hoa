const { verifyFromHeader } = require('../utils/jwt');

function authenticate(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  // Rejects a staff token here — the two id sequences both start at 1, so
  // without this a staff id could be mistaken for a resident id.
  if (payload.actorType !== 'resident') {
    return res.status(403).json({ error: 'Resident credentials required' });
  }

  req.user = payload; // { id, community_id, role, actorType }
  next();
}

module.exports = authenticate;
