const { generateToken, hashToken } = require('../src/utils/passwordResetToken');

describe('passwordResetToken utils', () => {
  test('generateToken produces a 64-character hex string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generateToken produces a different token on each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  test('hashToken is deterministic — the same input always produces the same hash', () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  test('hashToken produces different hashes for different tokens', () => {
    expect(hashToken(generateToken())).not.toBe(hashToken(generateToken()));
  });
});
