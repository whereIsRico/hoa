const express = require('express');

const GateStaff = require('../models/GateStaff');
const { sign } = require('../utils/jwt');
const { validateLogin } = require('../middleware/validate');

const router = express.Router();

router.post('/staff-login', validateLogin, async (req, res, next) => {
  try {
    const { community_id, email, password } = req.body;

    const staff = await GateStaff.findByEmailAndCommunity(email, community_id);
    // Inactive staff get the same generic error as "not found" — don't reveal
    // account status to an unauthenticated caller.
    if (!staff || !staff.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await GateStaff.verifyPassword(password, staff.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = sign({ id: staff.id, community_id: staff.community_id, actorType: 'gate_staff' });
    const { password_hash, ...safeStaff } = staff;

    res.json({ staff: safeStaff, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
