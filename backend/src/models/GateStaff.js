const pool = require('../config/db');
const password = require('../utils/password');

const PUBLIC_COLUMNS = `
  id, community_id, first_name, last_name, email, phone, is_active,
  shift_start, shift_end, created_at, updated_at
`;

// No create() here on purpose — staff accounts are provisioned by an HOA
// admin, not self-registered. Admin auth/CRUD doesn't exist yet, so for now
// accounts are seeded directly in the DB.

// Includes password_hash — only for internal use during login, never sent in a response.
async function findByEmailAndCommunity(email, communityId) {
  const { rows } = await pool.query(
    'SELECT * FROM gate_staff WHERE email = $1 AND community_id = $2',
    [email, communityId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM gate_staff WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function verifyPassword(plainPassword, passwordHash) {
  return password.compare(plainPassword, passwordHash);
}

module.exports = { findByEmailAndCommunity, findById, verifyPassword };
