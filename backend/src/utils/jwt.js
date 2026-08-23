const jwt = require('jsonwebtoken');

function sign(payload, options = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d', ...options });
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
