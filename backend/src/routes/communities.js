const express = require('express');

const Community = require('../models/Community');

const router = express.Router();

// Public: powers the community picker shown before login/register.
router.get('/', async (req, res, next) => {
  try {
    const communities = await Community.listActive();
    res.json({ communities });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
