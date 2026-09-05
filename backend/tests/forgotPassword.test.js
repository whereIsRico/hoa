const request = require('supertest');

jest.mock('../src/models/Resident');
jest.mock('../src/models/GateStaff');
jest.mock('../src/models/PlatformAdmin');
jest.mock('../src/models/PasswordResetToken');
jest.mock('../src/utils/email');

const Resident = require('../src/models/Resident');
const GateStaff = require('../src/models/GateStaff');
const PlatformAdmin = require('../src/models/PlatformAdmin');
const PasswordResetToken = require('../src/models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../src/utils/email');
const app = require('../src/app');

// This file makes several requests to the same rate-limited endpoints it's
// behaviorally testing (5-per-15-min, never reset between tests within a
// file since Jest gives each file one shared `app`/limiter instance). `trust
// proxy` is enabled in src/app.js, so express-rate-limit keys off
// X-Forwarded-For when present — give every request its own fake IP so this
// file never eats into the shared limiter's headroom, regardless of how many
// tests get added later. (The dedicated forgotPasswordRateLimit.test.js
// deliberately does NOT do this — it wants every request to share one IP so
// it can actually exercise the limit.)
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  PasswordResetToken.deleteForActor = jest.fn().mockResolvedValue(undefined);
  PasswordResetToken.create = jest.fn().mockResolvedValue({ id: 1 });
  sendPasswordResetEmail.mockResolvedValue(undefined);
});

describe('forgot-password: identical response whether the account exists or not', () => {
  test('resident — account exists', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', token_version: 1 });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('resident — account does not exist', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('gate staff — account exists and active', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    const res = await request(app)
      .post('/api/auth/staff-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('gate staff — account does not exist', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/staff-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('gate staff — account exists but inactive', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: false, token_version: 1 });
    const res = await request(app)
      .post('/api/auth/staff-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('platform admin — account exists and active', async () => {
    PlatformAdmin.findByEmail = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    const res = await request(app)
      .post('/api/auth/platform-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('platform admin — account does not exist', async () => {
    PlatformAdmin.findByEmail = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/platform-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('forgot-password: email send failure never changes the response', () => {
  test('resident — sendPasswordResetEmail rejecting still returns the generic 200', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', token_version: 1 });
    sendPasswordResetEmail.mockRejectedValue(new Error('Resend outage'));
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'If an account exists, a reset link has been sent.' });
  });

  test('gate staff — sendPasswordResetEmail rejecting still returns the generic 200', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    sendPasswordResetEmail.mockRejectedValue(new Error('Resend outage'));
    const res = await request(app)
      .post('/api/auth/staff-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'If an account exists, a reset link has been sent.' });
  });

  test('platform admin — sendPasswordResetEmail rejecting still returns the generic 200', async () => {
    PlatformAdmin.findByEmail = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    sendPasswordResetEmail.mockRejectedValue(new Error('Resend outage'));
    const res = await request(app)
      .post('/api/auth/platform-forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'If an account exists, a reset link has been sent.' });
  });
});

describe('forgot-password: a new request supersedes any prior token', () => {
  test('resident — deletes any existing token for this actor before creating a new one', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 42, email: 'a@test.com', token_version: 1 });
    await request(app)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', nextIp())
      .send({ community_id: 1, email: 'a@test.com' });
    expect(PasswordResetToken.deleteForActor).toHaveBeenCalledWith('resident', 42);
    expect(PasswordResetToken.create).toHaveBeenCalled();
  });
});
