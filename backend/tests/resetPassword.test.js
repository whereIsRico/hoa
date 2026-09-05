const request = require('supertest');

jest.mock('../src/models/Resident');
jest.mock('../src/models/GateStaff');
jest.mock('../src/models/PlatformAdmin');
jest.mock('../src/models/PasswordResetToken');
jest.mock('../src/models/AuditLog');
// The reset-password routes open a real transaction via pool.connect() (unlike
// every other model call in this suite, which goes through a mocked model
// method and never touches the actual pg Pool). tests/setup.js deliberately
// points DB_HOST at a non-resolvable dummy host so no test ever reaches a
// live DB — without this mock, pool.connect() would throw ENOTFOUND before
// the transaction even starts. Mock it the same way every other piece of I/O
// in this suite is mocked away.
jest.mock('../src/config/db', () => ({
  connect: jest.fn(),
}));

const Resident = require('../src/models/Resident');
const GateStaff = require('../src/models/GateStaff');
const PlatformAdmin = require('../src/models/PlatformAdmin');
const PasswordResetToken = require('../src/models/PasswordResetToken');
const AuditLog = require('../src/models/AuditLog');
const pool = require('../src/config/db');
const app = require('../src/app');

function fakeClient() {
  return {
    query: jest.fn().mockResolvedValue({}),
    release: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.log = jest.fn().mockResolvedValue(undefined);
  PasswordResetToken.remove = jest.fn().mockResolvedValue(undefined);
  pool.connect = jest.fn().mockResolvedValue(fakeClient());
});

describe('reset-password: resident', () => {
  test('valid token updates the password and bumps token_version', async () => {
    PasswordResetToken.findValidByHash = jest.fn().mockResolvedValue({
      id: 5, actor_type: 'resident', actor_id: 42, expires_at: new Date(Date.now() + 1000),
    });
    Resident.updatePassword = jest.fn().mockResolvedValue({ id: 42, community_id: 1 });
    Resident.incrementTokenVersion = jest.fn().mockResolvedValue({ id: 42 });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(Resident.updatePassword).toHaveBeenCalledWith(42, 'newpassword123', expect.anything());
    expect(Resident.incrementTokenVersion).toHaveBeenCalledWith(42, expect.anything());
    expect(PasswordResetToken.remove).toHaveBeenCalledWith(5, expect.anything());
  });

  test('rejects a token belonging to a different actor type', async () => {
    PasswordResetToken.findValidByHash = jest.fn().mockResolvedValue({
      id: 5, actor_type: 'gate_staff', actor_id: 42, expires_at: new Date(Date.now() + 1000),
    });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), new_password: 'newpassword123' });
    expect(res.status).toBe(400);
    expect(Resident.updatePassword).not.toHaveBeenCalled();
  });

  test('rejects an expired or nonexistent token with the same generic error', async () => {
    PasswordResetToken.findValidByHash = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), new_password: 'newpassword123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired reset link');
  });

  test('rejects a password shorter than 8 characters', async () => {
    PasswordResetToken.findValidByHash = jest.fn();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), new_password: 'short' });
    expect(res.status).toBe(400);
    expect(PasswordResetToken.findValidByHash).not.toHaveBeenCalled();
  });
});

describe('reset-password: gate staff', () => {
  test('valid token updates the password and bumps token_version', async () => {
    PasswordResetToken.findValidByHash = jest.fn().mockResolvedValue({
      id: 6, actor_type: 'gate_staff', actor_id: 7, expires_at: new Date(Date.now() + 1000),
    });
    GateStaff.updatePassword = jest.fn().mockResolvedValue({ id: 7, community_id: 1 });
    GateStaff.incrementTokenVersion = jest.fn().mockResolvedValue({ id: 7 });

    const res = await request(app)
      .post('/api/auth/staff-reset-password')
      .send({ token: 'b'.repeat(64), new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(GateStaff.updatePassword).toHaveBeenCalledWith(7, 'newpassword123', expect.anything());
    expect(GateStaff.incrementTokenVersion).toHaveBeenCalledWith(7, expect.anything());
  });
});

describe('reset-password: platform admin', () => {
  test('valid token updates the password, bumps token_version, and does not audit-log', async () => {
    PasswordResetToken.findValidByHash = jest.fn().mockResolvedValue({
      id: 8, actor_type: 'platform_admin', actor_id: 3, expires_at: new Date(Date.now() + 1000),
    });
    PlatformAdmin.updatePassword = jest.fn().mockResolvedValue({ id: 3 });
    PlatformAdmin.incrementTokenVersion = jest.fn().mockResolvedValue({ id: 3 });

    const res = await request(app)
      .post('/api/auth/platform-reset-password')
      .send({ token: 'c'.repeat(64), new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(PlatformAdmin.updatePassword).toHaveBeenCalledWith(3, 'newpassword123', expect.anything());
    expect(AuditLog.log).not.toHaveBeenCalled();
  });
});
