const express = require('express');

const GateStaff = require('../models/GateStaff');
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

module.exports = router;
