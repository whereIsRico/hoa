const pool = require('../config/db');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function create({ actor_type, actor_id, token_hash }, client = pool) {
  const expires_at = new Date(Date.now() + TOKEN_TTL_MS);
  const { rows } = await client.query(
    `INSERT INTO password_reset_tokens (actor_type, actor_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, actor_type, actor_id, token_hash, expires_at, created_at`,
    [actor_type, actor_id, token_hash, expires_at]
  );
  return rows[0];
}

// FOR UPDATE locks the row for the life of the caller's transaction, so a
// concurrent second reset-password request with the same token can't also
// read-and-use it before the first request's DELETE (Task 7) commits —
// same defensive pattern this codebase already uses for guest status
// transitions (Guest.findOwnedForUpdate/findInCommunityForUpdate).
async function findValidByHash(token_hash, client = pool) {
  const { rows } = await client.query(
    `SELECT id, actor_type, actor_id, token_hash, expires_at, created_at
     FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
     FOR UPDATE`,
    [token_hash]
  );
  return rows[0] || null;
}

// Called before issuing a new token for this actor, so requesting a new
// reset link invalidates any prior outstanding one — otherwise multiple
// old links would all stay valid simultaneously.
async function deleteForActor(actor_type, actor_id, client = pool) {
  await client.query(
    'DELETE FROM password_reset_tokens WHERE actor_type = $1 AND actor_id = $2',
    [actor_type, actor_id]
  );
}

async function remove(id, client = pool) {
  await client.query('DELETE FROM password_reset_tokens WHERE id = $1', [id]);
}

module.exports = { create, findValidByHash, deleteForActor, remove };
