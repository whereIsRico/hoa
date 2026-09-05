const request = require('supertest');
const app = require('../src/app');

const FORGOT_PASSWORD_ATTEMPT_LIMIT = 5;

describe('forgot-password endpoint rate limiting', () => {
  test('POST /api/auth/forgot-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < FORGOT_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/forgot-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/staff-forgot-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < FORGOT_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/staff-forgot-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/staff-forgot-password').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/platform-forgot-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < FORGOT_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/platform-forgot-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/platform-forgot-password').send({});
    expect(res.status).toBe(429);
  });
});
