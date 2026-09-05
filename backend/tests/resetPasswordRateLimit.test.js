const request = require('supertest');
const app = require('../src/app');

const RESET_PASSWORD_ATTEMPT_LIMIT = 5;

describe('reset-password endpoint rate limiting', () => {
  test('POST /api/auth/reset-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < RESET_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/reset-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/reset-password').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/staff-reset-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < RESET_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/staff-reset-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/staff-reset-password').send({});
    expect(res.status).toBe(429);
  });

  test('POST /api/auth/platform-reset-password rejects the attempt after the limit with 429', async () => {
    for (let i = 0; i < RESET_PASSWORD_ATTEMPT_LIMIT; i++) {
      const res = await request(app).post('/api/auth/platform-reset-password').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/platform-reset-password').send({});
    expect(res.status).toBe(429);
  });
});
