const pool = require('../config/db');
const password = require('../utils/password');
const { PROFILE_EDITABLE_FIELDS } = require('../middleware/validate');

const PUBLIC_COLUMNS = `
  id, community_id, email, first_name, last_name, phone, unit_number,
  is_approved, guest_limit_per_month, role, created_at, updated_at
`;

async function emailExistsInCommunity(email, communityId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM residents WHERE email = $1 AND community_id = $2',
    [email, communityId]
  );
  return rows.length > 0;
}

async function create({ community_id, email, password: plainPassword, first_name, last_name, phone, unit_number }) {
  const password_hash = await password.hash(plainPassword);
  const { rows } = await pool.query(
    `INSERT INTO residents (community_id, email, password_hash, first_name, last_name, phone, unit_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [community_id, email, password_hash, first_name, last_name, phone || null, unit_number || null]
  );
  return rows[0];
}

// Includes password_hash — only for internal use during login, never sent in a response.
async function findByEmailAndCommunity(email, communityId) {
  const { rows } = await pool.query(
    'SELECT * FROM residents WHERE email = $1 AND community_id = $2',
    [email, communityId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM residents WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function updateProfile(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of PROFILE_EDITABLE_FIELDS) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) {
    return findById(id);
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE residents SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${PUBLIC_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

async function verifyPassword(plainPassword, passwordHash) {
  return password.compare(plainPassword, passwordHash);
}

async function findByIdInCommunity(id, communityId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PUBLIC_COLUMNS} FROM residents WHERE id = $1 AND community_id = $2`,
    [id, communityId]
  );
  return rows[0] || null;
}

async function countAdminsInCommunity(communityId, client = pool) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS count FROM residents WHERE community_id = $1 AND role = 'admin'",
    [communityId]
  );
  return rows[0].count;
}

async function updateRole(id, role, client) {
  const { rows } = await client.query(
    `UPDATE residents SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [role, id]
  );
  return rows[0];
}

async function updateApproval(id, approved, client) {
  const { rows } = await client.query(
    `UPDATE residents SET is_approved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [approved, id]
  );
  return rows[0];
}

module.exports = {
  emailExistsInCommunity,
  create,
  findByEmailAndCommunity,
  findById,
  findByIdInCommunity,
  countAdminsInCommunity,
  updateRole,
  updateApproval,
  updateProfile,
  verifyPassword,
};
