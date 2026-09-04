const jwt = require('jsonwebtoken');
const { sign } = require('../src/utils/jwt');

// Locks in the 7d -> 24h shortening from the ARG-7 JWT-hardening pass —
// exactly the kind of regression that's easy to accidentally revert (e.g.
// someone "fixing" a login-expiring-too-soon complaint by bumping this back
// up) without a test calling it out specifically.
test('signed tokens expire in 24 hours, not 7 days', () => {
  const token = sign({ id: 1, actorType: 'resident' });
  const decoded = jwt.decode(token);

  const lifetimeSeconds = decoded.exp - decoded.iat;
  expect(lifetimeSeconds).toBe(24 * 60 * 60);
});
