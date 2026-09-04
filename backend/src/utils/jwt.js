const jwt = require('jsonwebtoken');

// 24h, not 7d: shortened as part of ARG-7's JWT-hardening pass. Combined
// with token_version-based revocation (see middleware/{auth,staffAuth,
// platformAuth}.js), this bounds how long a token nobody has explicitly
// revoked yet can still be used, without needing a refresh-token flow —
// deliberately chosen over something much shorter (e.g. 1h) since gate
// staff need to stay logged in through a full shift with no refresh
// mechanism to re-issue a token silently in the background.
function sign(payload, options = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h', ...options });
}

// Returns the decoded payload, or null if the header is missing/malformed or
// the token is invalid/expired. Callers decide what "null" means for them.
function verifyFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { sign, verifyFromHeader };
