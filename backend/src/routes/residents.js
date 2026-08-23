const express = require('express');

const Resident = require('../models/Resident');
const authenticate = require('../middleware/auth');
const { validateProfileUpdate } = require('../middleware/validate');

const router = express.Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const resident = await Resident.findById(req.user.id);
    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    res.json({ resident });
  } catch (err) {
    next(err);
  }
});

router.put('/me', authenticate, validateProfileUpdate, async (req, res, next) => {
  try {
    const updated = await Resident.updateProfile(req.user.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    res.json({ resident: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
