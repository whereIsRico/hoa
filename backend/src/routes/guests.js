const express = require('express');

const pool = require('../config/db');
const Guest = require('../models/Guest');
const Resident = require('../models/Resident');
const Policy = require('../models/Policy');
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

// One name per line in the policy's free-text field. Exact match on the
// normalized full name — no fuzzy/substring matching, since that would risk
// false positives (e.g. blacklisting "Smith" catching "Smithson").
function isBlacklisted(firstName, lastName, blacklistedVisitors) {
  if (!blacklistedVisitors) return false;
  const fullName = `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return blacklistedVisitors
    .split('\n')
    .map((line) => line.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .includes(fullName);
}

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

    const policy = await Policy.findByCommunity(resident.community_id);
    if (isBlacklisted(first_name, last_name, policy.blacklisted_visitors)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This guest cannot be registered — contact your HOA admin' });
    }

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

// Community-wide views — every guest in the caller's community, not just
// their own. Separate routes per actor (rather than one endpoint branching
// on caller identity) for the same reason checkin/checkout/approve/deny are
// separate: each actor's access is auth'd through its own middleware chain.
router.get('/gate', authenticateStaff, async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !GUEST_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${GUEST_STATUS_VALUES.join(', ')}` });
    }

    // Staff has no access to /api/admin/policy, but the check-in UI needs
    // auto_approval_enabled (which statuses can even show a check-in button)
    // and require_id_verification (whether to prompt for it) to render
    // correctly — so the relevant bits ride along with the guest list.
    const [guests, policy] = await Promise.all([
      Guest.listForCommunity(req.staff.community_id, { status }),
      Policy.findByCommunity(req.staff.community_id),
    ]);
    res.json({
      guests,
      policy: {
        auto_approval_enabled: policy.auto_approval_enabled,
        require_id_verification: policy.require_id_verification,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !GUEST_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${GUEST_STATUS_VALUES.join(', ')}` });
    }

    const guests = await Guest.listForCommunity(req.user.community_id, { status });
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

    const policy = await Policy.findByCommunity(req.staff.community_id);
    // When a community requires admin approval, a guest still sitting in
    // 'invited' hasn't been reviewed yet — only 'approved' guests get in.
    // When auto-approval is on, 'invited' is enough (the common case today).
    const checkInFromStatuses = policy.auto_approval_enabled ? ['invited', 'approved'] : ['approved'];
    if (!checkInFromStatuses.includes(guest.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Guest cannot be checked in from status: ${guest.status}` });
    }

    if (policy.require_id_verification && req.body.id_verified !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This community requires ID verification at check-in' });
    }

    const updated = await Guest.checkIn(id, client);

    await AuditLog.log(client, {
      community_id: req.staff.community_id,
      action: 'guest.checked_in',
      actor_id: req.staff.id,
      actor_type: 'gate_staff',
      resource_id: id,
      resource_type: 'guest',
      details: policy.require_id_verification ? { id_verified: true } : {},
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
