const express = require('express');

const Resident = require('../models/Resident');
const Policy = require('../models/Policy');
const { sign } = require('../utils/jwt');
const { validateRegister, validateLogin } = require('../middleware/validate');

const router = express.Router();

function signToken(resident) {
  return sign({ id: resident.id, community_id: resident.community_id, role: resident.role, actorType: 'resident' });
}

router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const { community_id, email, password, first_name, last_name, phone, unit_number } = req.body;

    const exists = await Resident.emailExistsInCommunity(email, community_id);
    if (exists) {
      return res.status(409).json({ error: 'An account with this email already exists for this community' });
    }

    // The community's configured monthly guest limit becomes this resident's
    // starting value — an admin can still override it per-resident later.
    const policy = await Policy.findByCommunity(community_id);

    const resident = await Resident.create({
      community_id, email, password, first_name, last_name, phone, unit_number,
      guest_limit_per_month: policy.max_guests_per_resident_per_month,
    });
    const token = signToken(resident);

    res.status(201).json({ resident, token });
  } catch (err) {
    // FK violation on a bad community_id
    if (err.code === '23503') {
      return res.status(400).json({ error: 'community_id does not refer to an existing community' });
    }
    next(err);
  }
});

router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { community_id, email, password } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await Resident.verifyPassword(password, resident.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(resident);
    const { password_hash, ...safeResident } = resident;

    res.json({ resident: safeResident, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
