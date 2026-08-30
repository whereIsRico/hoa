const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, name, email, phone, address, subscription_tier, monthly_fee, is_active, created_at, updated_at
`;

// Public-safe listing for a pre-login community picker — no billing/contact fields.
async function listActive() {
  const { rows } = await pool.query(
    'SELECT id, name FROM communities WHERE is_active = true ORDER BY name ASC'
  );
  return rows;
}

async function create({ name, email, phone, address, subscription_tier }, client) {
  const { rows } = await client.query(
    `INSERT INTO communities (name, email, phone, address, subscription_tier)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email || null, phone || null, address || null, subscription_tier || 'starter']
  );
  return rows[0];
}

// Includes subscription_status (nullable — a community with no subscriptions
// row yet, e.g. one that predates the billing feature, shows null/"Not set"
// downstream rather than throwing).
async function findById(id) {
  const { rows } = await pool.query(
    `SELECT
       c.id, c.name, c.email, c.phone, c.address, c.subscription_tier,
       c.monthly_fee, c.is_active, c.created_at, c.updated_at,
       s.status AS subscription_status
     FROM communities c
     LEFT JOIN subscriptions s ON s.community_id = c.id
     WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Real usage counts, not billing figures — there's no payment-processor
// data anywhere in this app yet (Stripe was never integrated). subscription_status
// reflects the internal subscriptions table (populated by onboarding and the
// billing-status route), nullable for any community predating that table.
async function listWithCounts() {
  const { rows } = await pool.query(`
    SELECT
      c.id, c.name, c.email, c.phone, c.address, c.subscription_tier,
      c.monthly_fee, c.is_active, c.created_at, c.updated_at,
      s.status AS subscription_status,
      (SELECT COUNT(*)::int FROM residents r WHERE r.community_id = c.id) AS resident_count,
      (SELECT COUNT(*)::int FROM guests g WHERE g.community_id = c.id) AS guest_count,
      (SELECT COUNT(*)::int FROM gate_staff gs WHERE gs.community_id = c.id) AS staff_count
    FROM communities c
    LEFT JOIN subscriptions s ON s.community_id = c.id
    ORDER BY c.created_at DESC
  `);
  return rows;
}

module.exports = { listActive, create, findById, listWithCounts };
