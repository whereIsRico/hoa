const Resident = require('../models/Resident');

// Must run after `authenticate` — relies on req.user being set from the JWT.
// Re-checks role against the DB rather than trusting the token's claim: a
// demoted admin's existing token would otherwise stay privileged for up to
// 7 days (the token lifetime), same reasoning as the is_approved re-check
// in guest creation.
async function requireAdmin(req, res, next) {
  try {
    const resident = await Resident.findById(req.user.id);
    if (!resident || resident.role !== 'admin') {
      return res.status(403).json({ error: 'Admin credentials required' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAdmin;
