const { sign } = require('../src/utils/jwt');

jest.mock('../src/models/Resident');
jest.mock('../src/models/GateStaff');
jest.mock('../src/models/PlatformAdmin');

const Resident = require('../src/models/Resident');
const GateStaff = require('../src/models/GateStaff');
const PlatformAdmin = require('../src/models/PlatformAdmin');
const authenticate = require('../src/middleware/auth');
const authenticateStaff = require('../src/middleware/staffAuth');
const authenticatePlatform = require('../src/middleware/platformAuth');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('token_version revocation', () => {
  describe('resident middleware (authenticate)', () => {
    test('allows a token whose token_version matches the DB', async () => {
      const token = sign({ id: 1, community_id: 1, role: 'resident', actorType: 'resident', token_version: 1 });
      Resident.getTokenVersion = jest.fn().mockResolvedValue(1);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('rejects a token whose token_version is stale (bumped since issue)', async () => {
      const token = sign({ id: 1, community_id: 1, role: 'resident', actorType: 'resident', token_version: 1 });
      Resident.getTokenVersion = jest.fn().mockResolvedValue(2);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('rejects a token for an account that no longer exists', async () => {
      const token = sign({ id: 999, community_id: 1, role: 'resident', actorType: 'resident', token_version: 1 });
      Resident.getTokenVersion = jest.fn().mockResolvedValue(null);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('gate staff middleware (authenticateStaff)', () => {
    test('rejects a token whose token_version is stale', async () => {
      const token = sign({ id: 1, community_id: 1, actorType: 'gate_staff', token_version: 1 });
      GateStaff.getTokenVersion = jest.fn().mockResolvedValue(2);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticateStaff(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('allows a token whose token_version matches', async () => {
      const token = sign({ id: 1, community_id: 1, actorType: 'gate_staff', token_version: 1 });
      GateStaff.getTokenVersion = jest.fn().mockResolvedValue(1);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticateStaff(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('platform admin middleware (authenticatePlatform)', () => {
    test('rejects a token whose token_version is stale', async () => {
      const token = sign({ id: 1, actorType: 'platform_admin', token_version: 1 });
      PlatformAdmin.getTokenVersion = jest.fn().mockResolvedValue(2);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticatePlatform(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('allows a token whose token_version matches', async () => {
      const token = sign({ id: 1, actorType: 'platform_admin', token_version: 1 });
      PlatformAdmin.getTokenVersion = jest.fn().mockResolvedValue(1);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticatePlatform(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
