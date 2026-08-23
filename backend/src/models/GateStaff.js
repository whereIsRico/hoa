const pool = require('../config/db');
const password = require('../utils/password');

const PUBLIC_COLUMNS = `
  id, community_id, first_name, last_name, email, phone, is_active,
  shift_start, shift_end, created_at, updated_at
`;

async function emailExistsInCommunity(email, communityId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM gate_staff WHERE email = $1 AND community_id = $2',
    [email, communityId]
  );
  return rows.length > 0;
}

// Called from routes/admin.js — staff accounts are provisioned by an HOA
// admin, never self-registered.
async function create(fields, client = pool) {
  const { community_id, first_name, last_name, email, password: plainPassword, phone, shift_start, shift_end } = fields;
  const password_hash = await password.hash(plainPassword);
  const { rows } = await client.query(
    `INSERT INTO gate_staff (community_id, first_name, last_name, email, password_hash, phone, shift_start, shift_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${PUBLIC_COLUMNS}`,
    [community_id, first_name, last_name, email, password_hash, phone || null, shift_start || null, shift_end || null]
  );
  return rows[0];
}

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

module.exports = { emailExistsInCommunity, create, findByEmailAndCommunity, findById, verifyPassword };
