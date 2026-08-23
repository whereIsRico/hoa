const pool = require('../config/db');

// Public-safe listing for a pre-login community picker — no billing/contact fields.
async function listActive() {
  const { rows } = await pool.query(
    'SELECT id, name FROM communities WHERE is_active = true ORDER BY name ASC'
  );
  return rows;
}

module.exports = { listActive };
