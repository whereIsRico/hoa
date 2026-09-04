const pool = require('../config/db');
const password = require('../utils/password');

const PUBLIC_COLUMNS = `id, first_name, last_name, email, is_active, created_at, updated_at`;

// Includes password_hash — only for internal use during login, never sent in a response.
async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM platform_admins WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM platform_admins WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function verifyPassword(plainPassword, passwordHash) {
  return password.compare(plainPassword, passwordHash);
}

// See Resident.getTokenVersion — same purpose, not part of PUBLIC_COLUMNS.
async function getTokenVersion(id) {
  const { rows } = await pool.query('SELECT token_version FROM platform_admins WHERE id = $1', [id]);
  return rows[0]?.token_version ?? null;
}

// See Resident.incrementTokenVersion — not yet called from anywhere.
async function incrementTokenVersion(id, client = pool) {
  const { rows } = await client.query(
    `UPDATE platform_admins SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findById, verifyPassword, getTokenVersion, incrementTokenVersion };
