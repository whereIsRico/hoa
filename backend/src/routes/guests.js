const express = require('express');

const pool = require('../config/db');
const Guest = require('../models/Guest');
const Resident = require('../models/Resident');
const AuditLog = require('../models/AuditLog');
const authenticate = require('../middleware/auth');
const authenticateStaff = require('../middleware/staffAuth');
const requireAdmin = require('../middleware/adminAuth');
const {
  validateGuestCreate,
  validateGuestUpdate,
  validateGuestDeny,
  GUEST_STATUS_VALUES,
  RESIDENT_SETTABLE_STATUS_VALUES,
} = require('../middleware/validate');

const router = express.Router();

router.post('/', authenticate, validateGuestCreate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-check approval/limit against the DB, not the JWT — is_approved and
    // guest_limit_per_month can change after the token was issued.
    const resident = await Resident.findById(req.user.id);
    if (!resident) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (!resident.is_approved) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Your account is pending HOA approval and cannot register guests yet' });
    }

    const limit = resident.guest_limit_per_month ?? 10;
    const countThisMonth = await Guest.countActiveThisMonthForResident(resident.id, client);
    if (countThisMonth >= limit) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: `Monthly guest limit reached (${limit} guests/month)` });
    }

    const {
      first_name, last_name, phone, license_plate, purpose,
      scheduled_arrival, scheduled_departure, notes,
    } = req.body;

    const guest = await Guest.create({
      resident_id: resident.id,
      community_id: resident.community_id,
      first_name, last_name, phone, license_plate, purpose,
      scheduled_arrival, scheduled_departure, notes,
    }, client);

    await AuditLog.log(client, {
      community_id: resident.community_id,
      action: 'guest.created',
      actor_id: resident.id,
      actor_type: 'resident',
      resource_id: guest.id,
      resource_type: 'guest',
      details: { status: guest.status },
    });

    await client.query('COMMIT');
    res.status(201).json({ guest });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid reference — resident or community not found' });
    }
    next(err);
  } finally {
    client.release();
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !GUEST_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${GUEST_STATUS_VALUES.join(', ')}` });
    }

    const guests = await Guest.listForResident(req.user.id, req.user.community_id, { status });
    res.json({ guests });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, validateGuestUpdate, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guest = await Guest.findOwnedForUpdate(id, req.user.id, req.user.community_id, client);
    if (!guest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Once a guest has moved past "invited" (approved, checked in, denied,
    // cancelled, checked out), the record is locked — editing it after the
    // fact would undermine the audit trail the whole product is built on.
    if (guest.status !== 'invited') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest can no longer be edited (current status: ${guest.status})` });
    }

    if (req.body.status !== undefined && !RESIDENT_SETTABLE_STATUS_VALUES.includes(req.body.status)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: "Residents can only cancel a guest invite. Check-in/out is performed by gate staff and approve/reject by HOA admins — those roles don't have accounts yet.",
      });
    }

    const updated = await Guest.update(id, req.body, client);

    await AuditLog.log(client, {
      community_id: req.user.community_id,
      action: req.body.status === 'cancelled' ? 'guest.cancelled' : 'guest.updated',
      actor_id: req.user.id,
      actor_type: 'resident',
      resource_id: id,
      resource_type: 'guest',
      details: { fields: Object.keys(req.body) },
    });

    await client.query('COMMIT');
    res.json({ guest: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// A guest can only be checked in from a state that means "expected but not
// here yet." 'approved' is included for forward-compatibility with the
// admin-approval flow, which isn't built yet — today guests only ever reach
// 'invited'.
const CHECK_IN_FROM_STATUSES = ['invited', 'approved'];

router.post('/:id/checkin', authenticateStaff, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guest = await Guest.findInCommunityForUpdate(id, req.staff.community_id, client);
    if (!guest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Guest not found' });
    }
    if (!CHECK_IN_FROM_STATUSES.includes(guest.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest cannot be checked in from status: ${guest.status}` });
    }

    const updated = await Guest.checkIn(id, client);

    await AuditLog.log(client, {
      community_id: req.staff.community_id,
      action: 'guest.checked_in',
      actor_id: req.staff.id,
      actor_type: 'gate_staff',
      resource_id: id,
      resource_type: 'guest',
      details: {},
    });

    await client.query('COMMIT');
    res.json({ guest: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/:id/checkout', authenticateStaff, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guest = await Guest.findInCommunityForUpdate(id, req.staff.community_id, client);
    if (!guest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Guest not found' });
    }
    if (guest.status !== 'checked_in') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest cannot be checked out from status: ${guest.status}` });
    }

    const updated = await Guest.checkOut(id, client);

    await AuditLog.log(client, {
      community_id: req.staff.community_id,
      action: 'guest.checked_out',
      actor_id: req.staff.id,
      actor_type: 'gate_staff',
      resource_id: id,
      resource_type: 'guest',
      details: {},
    });

    await client.query('COMMIT');
    res.json({ guest: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Admin actions act on any guest in their community, same scoping as staff.
// actor_type is 'admin' (not 'resident') even though the id still points
// into the residents table — it distinguishes "acted as themselves" from
// "acted with admin authority" in the audit trail.
const APPROVE_FROM_STATUSES = ['invited'];
const DENY_FROM_STATUSES = ['invited'];

router.post('/:id/approve', authenticate, requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guest = await Guest.findInCommunityForUpdate(id, req.user.community_id, client);
    if (!guest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Guest not found' });
    }
    if (!APPROVE_FROM_STATUSES.includes(guest.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest cannot be approved from status: ${guest.status}` });
    }

    const updated = await Guest.approve(id, client);

    await AuditLog.log(client, {
      community_id: req.user.community_id,
      action: 'guest.approved',
      actor_id: req.user.id,
      actor_type: 'admin',
      resource_id: id,
      resource_type: 'guest',
      details: {},
    });

    await client.query('COMMIT');
    res.json({ guest: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/:id/deny', authenticate, requireAdmin, validateGuestDeny, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guest = await Guest.findInCommunityForUpdate(id, req.user.community_id, client);
    if (!guest) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Guest not found' });
    }
    if (!DENY_FROM_STATUSES.includes(guest.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest cannot be denied from status: ${guest.status}` });
    }

    const updated = await Guest.deny(id, client);

    await AuditLog.log(client, {
      community_id: req.user.community_id,
      action: 'guest.denied',
      actor_id: req.user.id,
      actor_type: 'admin',
      resource_id: id,
      resource_type: 'guest',
      details: { reason: req.body.reason || null },
    });

    await client.query('COMMIT');
    res.json({ guest: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
