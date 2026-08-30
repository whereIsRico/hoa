const pool = require('../config/db');

// Called within the same DB transaction as the action it records, so the
// action and its audit trail commit or roll back together.
async function log(client, { community_id, action, actor_id, actor_type, resource_id, resource_type, details }) {
  await client.query(
    `INSERT INTO audit_logs (community_id, action, actor_id, actor_type, resource_id, resource_type, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [community_id, action, actor_id, actor_type, String(resource_id), resource_type, details ? JSON.stringify(details) : null]
  );
}

// Platform-admin support tool: recent activity for a community, for
// answering "what happened here" questions using real compliance data
// that already exists, rather than a bespoke support-ticket system.
async function listForCommunity(communityId, { limit = 100 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, action, actor_id, actor_type, resource_id, resource_type, details, created_at
     FROM audit_logs WHERE community_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [communityId, limit]
  );
  return rows;
}

// System Health's staleness signal: most recent recorded action per
// community. This reflects guest/admin lifecycle actions written to this
// table, not raw HTTP traffic — a quiet community isn't necessarily an
// unhealthy one, just one with nothing logged recently.
async function lastActivityByCommunity() {
  const { rows } = await pool.query(
    `SELECT community_id, MAX(created_at) AS last_activity
     FROM audit_logs GROUP BY community_id`
  );
  return rows;
}

module.exports = { log, listForCommunity, lastActivityByCommunity };
