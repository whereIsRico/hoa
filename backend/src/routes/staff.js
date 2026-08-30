const express = require('express');

const GateStaff = require('../models/GateStaff');
const Resident = require('../models/Resident');
const Community = require('../models/Community');
const authenticateStaff = require('../middleware/staffAuth');

const router = express.Router();

router.get('/me', authenticateStaff, async (req, res, next) => {
  try {
    const staff = await GateStaff.findById(req.staff.id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff account not found' });
    }
    res.json({ staff });
  } catch (err) {
    next(err);
  }
});

// Read-only directory for gate staff — no approve/promote actions live here,
// just enough to search/view/call. Scoped to the staff member's own
// community from the token, same reasoning as every other community_id
// scoping in this file.
router.get('/residents', authenticateStaff, async (req, res, next) => {
  try {
    const residents = await Resident.listForCommunity(req.staff.community_id);
    res.json({ residents });
  } catch (err) {
    next(err);
  }
});

router.get('/community', authenticateStaff, async (req, res, next) => {
  try {
    const community = await Community.findById(req.staff.community_id);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    res.json({ community });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
