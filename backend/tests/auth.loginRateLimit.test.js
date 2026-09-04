const request = require('supertest');
const app = require('../src/app');

// Rate-limit middleware runs before body validation on every route in this
// codebase (see registerLimiter/verifyEmailLimiter/resendCodeLimiter in
// auth.js), so an intentionally empty body is enough to exercise the
// limiter without needing a live DB — every attempt still counts against
// the limit even though each one individually fails validation with 400.
const LOGIN_ATTEMPT_LIMIT = 5;

describe('login endpoint rate limiting', () => {
  test('POST /api/auth/login rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    }

    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/staff-login rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/staff-login').send({});
      expect(res.status).toBe(400);
    }

    const res = await request(app).post('/api/auth/staff-login').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/platform-login rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/platform-login').send({});
      expect(res.status).toBe(400);
    }

    const res = await request(app).post('/api/auth/platform-login').send({});
    expect(res.status).toBe(429);
  });
});
