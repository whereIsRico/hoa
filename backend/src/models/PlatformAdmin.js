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

module.exports = { findByEmail, findById, verifyPassword };
