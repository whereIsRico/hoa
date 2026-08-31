const pool = require('../config/db');
const password = require('../utils/password');

const CODE_TTL_MS = 15 * 60 * 1000;

// Hashes internally, mirroring Resident.create's treatment of the plain
// password — callers never touch utils/password.js directly.
async function create(residentId, plainCode, client = pool) {
  const code_hash = await password.hash(plainCode);
  const expires_at = new Date(Date.now() + CODE_TTL_MS);
  const { rows } = await client.query(
    `INSERT INTO email_verifications (resident_id, code_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, resident_id, code_hash, expires_at, created_at`,
    [residentId, code_hash, expires_at]
  );
  return rows[0];
}

async function findLatestForResident(residentId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, resident_id, code_hash, expires_at, created_at
     FROM email_verifications WHERE resident_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [residentId]
  );
  return rows[0] || null;
}

async function matchesCode(verification, plainCode) {
  return password.compare(plainCode, verification.code_hash);
}

async function remove(id, client = pool) {
  await client.query('DELETE FROM email_verifications WHERE id = $1', [id]);
}

module.exports = { create, findLatestForResident, matchesCode, remove };
