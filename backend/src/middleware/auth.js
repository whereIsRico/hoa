const { verifyFromHeader } = require('../utils/jwt');
const Resident = require('../models/Resident');

async function authenticate(req, res, next) {
  const payload = verifyFromHeader(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'Missing, invalid, or expired token' });
  }
  // Rejects a staff token here — the two id sequences both start at 1, so
  // without this a staff id could be mistaken for a resident id.
  if (payload.actorType !== 'resident') {
    return res.status(403).json({ error: 'Resident credentials required' });
  }

  try {
    // Revocation check: a token issued before token_version was last bumped
    // (password change, deactivation, "log out everywhere") is rejected
    // even though it's still cryptographically valid and unexpired — same
    // "don't just trust the token for up to 7/24h" reasoning as
    // middleware/adminAuth.js's role re-check, just for the base identity
    // rather than a specific role.
    const currentVersion = await Resident.getTokenVersion(payload.id);
    if (currentVersion === null || currentVersion !== payload.token_version) {
      return res.status(401).json({ error: 'Missing, invalid, or expired token' });
    }
  } catch (err) {
    return next(err);
  }

  req.user = payload; // { id, community_id, role, actorType, token_version }
  next();
}

module.exports = authenticate;
