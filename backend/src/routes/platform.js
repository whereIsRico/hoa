const express = require('express');

const pool = require('../config/db');
const Community = require('../models/Community');
const Resident = require('../models/Resident');
const PlatformAdmin = require('../models/PlatformAdmin');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const authenticatePlatform = require('../middleware/platformAuth');
const { validateCommunityOnboard } = require('../middleware/validate');

const router = express.Router();

router.get('/me', authenticatePlatform, async (req, res, next) => {
  try {
    const admin = await PlatformAdmin.findById(req.platformAdmin.id);
    if (!admin) {
      return res.status(404).json({ error: 'Platform admin not found' });
    }
    res.json({ platformAdmin: admin });
  } catch (err) {
    next(err);
  }
});

router.get('/communities', authenticatePlatform, async (req, res, next) => {
  try {
    const communities = await Community.listWithCounts();
    res.json({ communities });
  } catch (err) {
    next(err);
  }
});

router.get('/communities/:id/audit-logs', authenticatePlatform, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid community id' });
  }

  try {
    const community = await Community.findById(id);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    const auditLogs = await AuditLog.listForCommunity(id);
    res.json({ community, auditLogs });
  } catch (err) {
    next(err);
  }
});

// Onboards a brand-new HOA: creates the community and its first admin
// resident together, atomically. This is the one place an admin gets
// created with is_approved=true and role='admin' from the start, skipping
// the normal self-registration approval gate — the platform admin is
// directly vouching for this account, not a peer admin approving a stranger.
router.post('/communities', authenticatePlatform, validateCommunityOnboard, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      community_name, community_email, community_phone, community_address, subscription_tier,
      admin_first_name, admin_last_name, admin_email, admin_password,
    } = req.body;

    const community = await Community.create({
      name: community_name,
      email: community_email,
      phone: community_phone,
      address: community_address,
      subscription_tier,
    }, client);

    const policy = await Policy.createDefault(community.id, client);

    const admin = await Resident.create({
      community_id: community.id,
      email: admin_email,
      password: admin_password,
      first_name: admin_first_name,
      last_name: admin_last_name,
      guest_limit_per_month: policy.max_guests_per_resident_per_month,
    }, client);

    const approvedAdmin = await Resident.updateApproval(admin.id, true, client);
    const finalAdmin = await Resident.updateRole(approvedAdmin.id, 'admin', client);

    await AuditLog.log(client, {
      community_id: community.id,
      action: 'community.onboarded',
      actor_id: req.platformAdmin.id,
      actor_type: 'platform_admin',
      resource_id: community.id,
      resource_type: 'community',
      details: { admin_email: finalAdmin.email },
    });

    await client.query('COMMIT');
    res.status(201).json({ community, admin: finalAdmin });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
