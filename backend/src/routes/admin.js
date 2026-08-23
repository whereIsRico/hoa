const express = require('express');

const pool = require('../config/db');
const Resident = require('../models/Resident');
const GateStaff = require('../models/GateStaff');
const AuditLog = require('../models/AuditLog');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/adminAuth');
const { validateStaffCreate, validateRoleChange } = require('../middleware/validate');

const router = express.Router();

router.post('/staff', authenticate, requireAdmin, validateStaffCreate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { first_name, last_name, email, password, phone, shift_start, shift_end } = req.body;

    // community_id always comes from the admin's own token, never the
    // request body — otherwise an admin could provision staff into a
    // community that isn't theirs.
    const exists = await GateStaff.emailExistsInCommunity(email, req.user.community_id);
    if (exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A staff account with this email already exists for this community' });
    }

    const staff = await GateStaff.create({
      community_id: req.user.community_id,
      first_name, last_name, email, password, phone, shift_start, shift_end,
    }, client);

    await AuditLog.log(client, {
      community_id: req.user.community_id,
      action: 'staff.created',
      actor_id: req.user.id,
      actor_type: 'admin',
      resource_id: staff.id,
      resource_type: 'gate_staff',
      details: { email: staff.email },
    });

    await client.query('COMMIT');
    res.status(201).json({ staff });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.put('/residents/:id/role', authenticate, requireAdmin, validateRoleChange, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid resident id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resident = await Resident.findByIdInCommunity(id, req.user.community_id, client);
    if (!resident) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Resident not found' });
    }

    const { role } = req.body;
    if (resident.role === role) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Resident already has role: ${role}` });
    }

    // Block demoting the community's only admin — that recreates the exact
    // bootstrap problem this endpoint exists to solve: nobody left who can
    // approve residents, provision staff, or re-promote anyone without
    // direct DB access.
    if (resident.role === 'admin' && role === 'resident') {
      const adminCount = await Resident.countAdminsInCommunity(req.user.community_id, client);
      if (adminCount <= 1) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Cannot demote the last admin in this community' });
      }
    }

    const updated = await Resident.updateRole(id, role, client);

    await AuditLog.log(client, {
      community_id: req.user.community_id,
      action: 'resident.role_changed',
      actor_id: req.user.id,
      actor_type: 'admin',
      resource_id: id,
      resource_type: 'resident',
      details: { from: resident.role, to: role },
    });

    await client.query('COMMIT');
    res.json({ resident: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
