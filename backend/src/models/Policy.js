const pool = require('../config/db');

const PUBLIC_COLUMNS = `
  id, community_id, max_guests_per_resident_per_month, blacklisted_visitors,
  require_id_verification, guest_checkout_required, auto_approval_enabled,
  created_at, updated_at
`;

// Every community should have exactly one policy row (schema enforces this
// via a UNIQUE community_id), but communities created before this feature
// existed don't have one yet. Self-heal by creating the row with schema
// defaults on first read, rather than requiring a separate backfill script.
async function findByCommunity(communityId) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM policies WHERE community_id = $1`,
    [communityId]
  );
  if (rows[0]) return rows[0];

  const created = await pool.query(
    `INSERT INTO policies (community_id) VALUES ($1) RETURNING ${PUBLIC_COLUMNS}`,
    [communityId]
  );
  return created.rows[0];
}

async function update(communityId, fields, client = pool) {
  const editable = [
    'max_guests_per_resident_per_month', 'blacklisted_visitors',
    'require_id_verification', 'guest_checkout_required', 'auto_approval_enabled',
  ];
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of editable) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return findByCommunity(communityId);

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(communityId);

  const { rows } = await client.query(
    `UPDATE policies SET ${sets.join(', ')} WHERE community_id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0];
}

// Called directly during community onboarding so a brand-new HOA has an
// explicit policy row from day one, rather than relying only on the
// self-healing read above.
async function createDefault(communityId, client) {
  const { rows } = await client.query(
    `INSERT INTO policies (community_id) VALUES ($1) RETURNING ${PUBLIC_COLUMNS}`,
    [communityId]
  );
  return rows[0];
}

module.exports = { findByCommunity, update, createDefault };
