const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, community_id, tier, monthly_fee, status, billing_email,
  billing_cycle_day, next_billing_date, stripe_customer_id, created_at, updated_at
`;

async function findByCommunity(communityId) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM subscriptions WHERE community_id = $1`,
    [communityId]
  );
  return rows[0] || null;
}

// Called from the same transaction as community onboarding — status always
// starts 'active' there (the schema's own default). A pre-existing
// subscriptions row is never overwritten by this; callers that need a
// different starting status (e.g. the billing-status route backfilling a
// community that predates this table) follow up with updateStatus.
async function createDefault(communityId, tier, monthlyFee, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO subscriptions (community_id, tier, monthly_fee, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING ${PUBLIC_COLUMNS}`,
    [communityId, tier || 'starter', monthlyFee || null]
  );
  return rows[0];
}

async function updateStatus(communityId, status, client = pool) {
  const { rows } = await client.query(
    `UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE community_id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [status, communityId]
  );
  return rows[0] || null;
}

module.exports = { findByCommunity, createDefault, updateStatus };
