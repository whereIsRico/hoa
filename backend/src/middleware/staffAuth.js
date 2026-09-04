const { verifyFromHeader } = require('../utils/jwt');
const GateStaff = require('../models/GateStaff');

async function authenticateStaff(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  if (payload.actorType !== 'gate_staff') {
    return res.status(403).json({ error: 'Gate staff credentials required' });
  }

  try {
    // See middleware/auth.js for why this check exists.
    const currentVersion = await GateStaff.getTokenVersion(payload.id);
    if (currentVersion === null || currentVersion !== payload.token_version) {
      return res.status(401).json({ error: 'Missing, invalid, or expired token' });
    }
  } catch (err) {
    return next(err);
  }

  req.staff = payload; // { id, community_id, actorType, token_version }
  next();
}

module.exports = authenticateStaff;
