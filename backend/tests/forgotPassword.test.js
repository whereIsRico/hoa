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

beforeEach(() => {
  jest.clearAllMocks();
  PasswordResetToken.deleteForActor = jest.fn().mockResolvedValue(undefined);
  PasswordResetToken.create = jest.fn().mockResolvedValue({ id: 1 });
  sendPasswordResetEmail.mockResolvedValue(undefined);
});

describe('forgot-password: identical response whether the account exists or not', () => {
  test('resident — account exists', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', token_version: 1 });
    const res = await request(app).post('/api/auth/forgot-password').send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('resident — account does not exist', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/auth/forgot-password').send({ community_id: 1, email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('gate staff — account exists and active', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    const res = await request(app).post('/api/auth/staff-forgot-password').send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('gate staff — account does not exist', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/auth/staff-forgot-password').send({ community_id: 1, email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('gate staff — account exists but inactive', async () => {
    GateStaff.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: false, token_version: 1 });
    const res = await request(app).post('/api/auth/staff-forgot-password').send({ community_id: 1, email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('platform admin — account exists and active', async () => {
    PlatformAdmin.findByEmail = jest.fn().mockResolvedValue({ id: 1, email: 'a@test.com', is_active: true, token_version: 1 });
    const res = await request(app).post('/api/auth/platform-forgot-password').send({ email: 'a@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('platform admin — account does not exist', async () => {
    PlatformAdmin.findByEmail = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/auth/platform-forgot-password').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('forgot-password: a new request supersedes any prior token', () => {
  test('resident — deletes any existing token for this actor before creating a new one', async () => {
    Resident.findByEmailAndCommunity = jest.fn().mockResolvedValue({ id: 42, email: 'a@test.com', token_version: 1 });
    await request(app).post('/api/auth/forgot-password').send({ community_id: 1, email: 'a@test.com' });
    expect(PasswordResetToken.deleteForActor).toHaveBeenCalledWith('resident', 42);
    expect(PasswordResetToken.create).toHaveBeenCalled();
  });
});
