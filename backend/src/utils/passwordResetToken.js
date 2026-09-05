const crypto = require('crypto');

// 32 random bytes = 64 hex chars. Sent only in the emailed link, never
// stored in plaintext — only the SHA-256 hash below is persisted.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Deterministic (unlike bcrypt) so a reset-password request can look its
// row up by `WHERE token_hash = $1` — the backend only ever receives the
// raw token itself, not an actor id, so it has to find the row BY the
// token. The token is already 256 bits of random entropy, so a fast hash
// costs nothing in practice; bcrypt's slowness exists to resist brute
// force of a LOW-entropy secret (a password), which doesn't apply here.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateToken, hashToken };
