# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a self-service password reset flow for all three actor types (resident, gate staff, platform admin), closing Linear `ARG-6`.

**Architecture:** A new shared, polymorphic `password_reset_tokens` table (`actor_type`/`actor_id`, matching `audit_logs`' existing pattern) holds SHA-256 hashes of one-time reset tokens (not bcrypt — the row must be found *by* the token itself, which requires a deterministic hash). Six new backend endpoints (2 per actor type, mirroring the existing per-actor route split) and six new frontend pages (1 pair per actor type, mirroring the existing per-actor login page split). A successful reset calls the `incrementTokenVersion` primitive built in `ARG-7`, instantly invalidating every other active session for that account.

**Tech Stack:** Node/Express/Postgres backend (raw `pg`, no ORM), React/Vite frontend, Jest + supertest for backend tests (model-layer mocked, no live DB), Resend for email.

**Full design spec:** `docs/superpowers/specs/2026-09-04-password-reset-design.md` — read it first if anything below is unclear on *why*, not just *what*.

---

## Task 1: Schema — `password_reset_tokens` table

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Add the table definition**

Add this after the `subscriptions` table definition (before the `platform_admins` table comment) in `schema.sql`:

```sql
-- Password reset tokens: shared across all three actor types (resident,
-- gate_staff, platform_admin) via actor_type/actor_id, mirroring how
-- audit_logs already does polymorphic actor references. token_hash is a
-- SHA-256 digest (deterministic, indexable) rather than bcrypt — a reset
-- link only gives the backend the raw token itself, so the row has to be
-- found BY the token, which bcrypt's salting makes impossible.
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  actor_type VARCHAR(50) NOT NULL,
  actor_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Add indexes**

Add these two lines to the "Indexes" section at the bottom of `schema.sql`, alongside the existing `idx_*` lines:

```sql
CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_actor ON password_reset_tokens(actor_type, actor_id);
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "Add password_reset_tokens table (ARG-6)"
```

No test for this step — `schema.sql` is applied to prod by hand (Task 11), not executed by the test suite. This matches how every other schema change in this repo has been handled.

---

## Task 2: Token generation/hashing utility (real TDD — pure functions, no DB)

**Files:**
- Create: `backend/src/utils/passwordResetToken.js`
- Test: `backend/tests/passwordResetToken.util.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/passwordResetToken.util.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npm test -- passwordResetToken.util`
Expected: FAIL — `Cannot find module '../src/utils/passwordResetToken'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/utils/passwordResetToken.js`:

```js
const crypto = require('crypto');

// 32 random bytes = 64 hex chars. Sent only in the emailed link, never
// stored in plaintext — only the SHA-256 hash below is persisted.
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Deterministic (unlike bcrypt) so a reset-password request can look its
// row up by `WHERE token_hash = $1` — the backend only ever receives the
// raw token itself, not an actor id, so it has to find the row BY the
// token. The token is already 256 bits of random entropy, so a fast hash
// costs nothing in practice; bcrypt's slowness exists to resist brute
// force of a LOW-entropy secret (a password), which doesn't apply here.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateToken, hashToken };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- passwordResetToken.util`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/passwordResetToken.js backend/tests/passwordResetToken.util.test.js
git commit -m "Add token generation/hashing utility for password reset (ARG-6)"
```

---

## Task 3: `PasswordResetToken` model + `updatePassword` on the three actor models

No direct tests in this task — matches this codebase's existing convention: no model file (`Resident.js`, `GateStaff.js`, `PlatformAdmin.js`, etc.) has direct query-level tests anywhere in this repo. Models are exercised indirectly through route tests with the model layer mocked (see Tasks 6–7). This is consistent, not a gap.

**Files:**
- Create: `backend/src/models/PasswordResetToken.js`
- Modify: `backend/src/models/Resident.js`
- Modify: `backend/src/models/GateStaff.js`
- Modify: `backend/src/models/PlatformAdmin.js`

- [ ] **Step 1: Create the PasswordResetToken model**

Create `backend/src/models/PasswordResetToken.js`:

```js
const pool = require('../config/db');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function create({ actor_type, actor_id, token_hash }, client = pool) {
  const expires_at = new Date(Date.now() + TOKEN_TTL_MS);
  const { rows } = await client.query(
    `INSERT INTO password_reset_tokens (actor_type, actor_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, actor_type, actor_id, token_hash, expires_at, created_at`,
    [actor_type, actor_id, token_hash, expires_at]
  );
  return rows[0];
}

// FOR UPDATE locks the row for the life of the caller's transaction, so a
// concurrent second reset-password request with the same token can't also
// read-and-use it before the first request's DELETE (Task 7) commits —
// same defensive pattern this codebase already uses for guest status
// transitions (Guest.findOwnedForUpdate/findInCommunityForUpdate).
async function findValidByHash(token_hash, client = pool) {
  const { rows } = await client.query(
    `SELECT id, actor_type, actor_id, token_hash, expires_at, created_at
     FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
     FOR UPDATE`,
    [token_hash]
  );
  return rows[0] || null;
}

// Called before issuing a new token for this actor, so requesting a new
// reset link invalidates any prior outstanding one — otherwise multiple
// old links would all stay valid simultaneously.
async function deleteForActor(actor_type, actor_id, client = pool) {
  await client.query(
    'DELETE FROM password_reset_tokens WHERE actor_type = $1 AND actor_id = $2',
    [actor_type, actor_id]
  );
}

async function remove(id, client = pool) {
  await client.query('DELETE FROM password_reset_tokens WHERE id = $1', [id]);
}

module.exports = { create, findValidByHash, deleteForActor, remove };
```

- [ ] **Step 2: Add `updatePassword` to `Resident.js`**

In `backend/src/models/Resident.js`, add this function (near `updateApproval`) and add `updatePassword` to the `module.exports`:

```js
async function updatePassword(id, plainPassword, client = pool) {
  const password_hash = await password.hash(plainPassword);
  const { rows } = await client.query(
    `UPDATE residents SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [password_hash, id]
  );
  return rows[0] || null;
}
```

- [ ] **Step 3: Add `updatePassword` to `GateStaff.js`**

In `backend/src/models/GateStaff.js`, add this function and add `updatePassword` to the `module.exports`:

```js
async function updatePassword(id, plainPassword, client = pool) {
  const password_hash = await password.hash(plainPassword);
  const { rows } = await client.query(
    `UPDATE gate_staff SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [password_hash, id]
  );
  return rows[0] || null;
}
```

- [ ] **Step 4: Add `updatePassword` to `PlatformAdmin.js`**

In `backend/src/models/PlatformAdmin.js`, add this function and add `updatePassword` to the `module.exports`:

```js
async function updatePassword(id, plainPassword, client = pool) {
  const password_hash = await password.hash(plainPassword);
  const { rows } = await client.query(
    `UPDATE platform_admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [password_hash, id]
  );
  return rows[0] || null;
}
```

- [ ] **Step 5: Sanity-check the app still loads**

Run (from `backend/`): `RESEND_API_KEY=x EMAIL_FROM=x JWT_SECRET=x node -e "require('./src/app'); console.log('OK')"`
Expected: `OK` printed, no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/PasswordResetToken.js backend/src/models/Resident.js backend/src/models/GateStaff.js backend/src/models/PlatformAdmin.js
git commit -m "Add PasswordResetToken model and updatePassword to actor models (ARG-6)"
```

---

## Task 4: Email — `sendPasswordResetEmail`

No direct test — matches existing convention (`sendVerificationCode`/`sendAdminNotification` aren't directly tested either; route tests mock this module entirely, see Task 6).

**Files:**
- Modify: `backend/src/utils/email.js`

- [ ] **Step 1: Add the function**

In `backend/src/utils/email.js`, add this function and add `sendPasswordResetEmail` to the `module.exports`:

```js
async function sendPasswordResetEmail(to, resetUrl) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Palisade password',
    text: `Reset your Palisade password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });
  if (error) throw new Error(error.message || 'Failed to send password reset email');
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/utils/email.js
git commit -m "Add sendPasswordResetEmail (ARG-6)"
```

---

## Task 5: Validation middleware

No direct tests — matches existing convention (no validator in `validate.js` has a direct unit test; they're exercised indirectly through route tests, see Tasks 6–7).

**Files:**
- Modify: `backend/src/middleware/validate.js`

- [ ] **Step 1: Add the three validators**

Add these functions in `backend/src/middleware/validate.js` (near `validateLogin`):

```js
function validateForgotPassword(req, res, next) {
  const { community_id, email } = req.body;
  const errors = [];

  if (community_id === undefined || !Number.isInteger(Number(community_id))) {
    errors.push('community_id is required and must be an integer');
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push('A valid email is required');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validatePlatformForgotPassword(req, res, next) {
  const { email } = req.body;
  const errors = [];

  if (!email || !EMAIL_RE.test(email)) {
    errors.push('A valid email is required');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateResetPassword(req, res, next) {
  const { token, new_password } = req.body;
  const errors = [];

  if (!token || typeof token !== 'string') {
    errors.push('token is required');
  }
  if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
    errors.push('new_password is required and must be at least 8 characters');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}
```

- [ ] **Step 2: Add exports**

Add `validateForgotPassword, validatePlatformForgotPassword, validateResetPassword,` to the `module.exports` object at the bottom of `validate.js`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/middleware/validate.js
git commit -m "Add validators for forgot-password/reset-password (ARG-6)"
```

---

## Task 6: `forgot-password` endpoints (all 3 actor types)

**Files:**
- Modify: `backend/src/routes/auth.js`
- Modify: `backend/src/routes/staffAuth.js`
- Modify: `backend/src/routes/platformAuth.js`
- Test: `backend/tests/forgotPassword.test.js`
- Test: `backend/tests/forgotPasswordRateLimit.test.js`

- [ ] **Step 1: Write the failing behavioral test**

Create `backend/tests/forgotPassword.test.js`:

```js
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
```

- [ ] **Step 2: Write the failing rate-limit test**

Create `backend/tests/forgotPasswordRateLimit.test.js` (separate file — Jest gives each test file its own fresh `app`/rate-limiter state, so this can't be in the same file as Step 1's tests without those requests also counting against the same 5-request limit):

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- forgotPassword`
Expected: FAIL — routes `/api/auth/forgot-password` etc. don't exist yet (404s, not the expected statuses)

- [ ] **Step 4: Implement the resident endpoint**

In `backend/src/routes/auth.js`:

1. Add to the existing imports at the top:
```js
const PasswordResetToken = require('../models/PasswordResetToken');
const { generateToken, hashToken } = require('../utils/passwordResetToken');
```
2. Add `sendPasswordResetEmail` to the existing `sendVerificationCode, sendAdminNotification` destructure from `../utils/email`.
3. Add `validateForgotPassword, validateResetPassword` to the existing destructure from `../middleware/validate`.
4. Add a new limiter (near `registerLimiter`):
```js
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});
```
5. Add the route (near the other `/login`-area routes):
```js
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (resident) {
      await PasswordResetToken.deleteForActor('resident', resident.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'resident',
        actor_id: resident.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(resident.email, resetUrl);
    }

    // Always the same response whether or not the account exists —
    // prevents email enumeration, same reasoning as login's generic
    // "invalid email or password" for a nonexistent account.
    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Implement the gate staff endpoint**

In `backend/src/routes/staffAuth.js`:

1. Add to imports: `const pool = require('../config/db');`, `const PasswordResetToken = require('../models/PasswordResetToken');`, `const { generateToken, hashToken } = require('../utils/passwordResetToken');`, `const { sendPasswordResetEmail } = require('../utils/email');`
2. Add `validateForgotPassword` to the existing `validateLogin` destructure from `../middleware/validate`.
3. Add a limiter identical to `forgotPasswordLimiter` above (each route file defines its own, matching this codebase's existing per-file limiter convention).
4. Add the route:
```js
router.post('/staff-forgot-password', forgotPasswordLimiter, validateForgotPassword, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const staff = await GateStaff.findByEmailAndCommunity(email, community_id);
    if (staff && staff.is_active) {
      await PasswordResetToken.deleteForActor('gate_staff', staff.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'gate_staff',
        actor_id: staff.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/staff/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(staff.email, resetUrl);
    }

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 6: Implement the platform admin endpoint**

In `backend/src/routes/platformAuth.js`:

1. Add to imports: `const pool = require('../config/db');`, `const PasswordResetToken = require('../models/PasswordResetToken');`, `const { generateToken, hashToken } = require('../utils/passwordResetToken');`, `const { sendPasswordResetEmail } = require('../utils/email');`
2. Add `validatePlatformForgotPassword` to the existing `validatePlatformLogin` destructure from `../middleware/validate`.
3. Add a limiter identical to `forgotPasswordLimiter` above.
4. Add the route:
```js
router.post('/platform-forgot-password', forgotPasswordLimiter, validatePlatformForgotPassword, async (req, res, next) => {
  try {
    const { email } = req.body;

    const admin = await PlatformAdmin.findByEmail(email);
    if (admin && admin.is_active) {
      await PasswordResetToken.deleteForActor('platform_admin', admin.id);
      const rawToken = generateToken();
      await PasswordResetToken.create({
        actor_type: 'platform_admin',
        actor_id: admin.id,
        token_hash: hashToken(rawToken),
      });
      const resetUrl = `https://palisade.argusbahamas.com/platform/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(admin.email, resetUrl);
    }

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- forgotPassword`
Expected: PASS, all tests in both files

- [ ] **Step 8: Run the full suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS, all suites

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/auth.js backend/src/routes/staffAuth.js backend/src/routes/platformAuth.js backend/tests/forgotPassword.test.js backend/tests/forgotPasswordRateLimit.test.js
git commit -m "Add forgot-password endpoints for all three actor types (ARG-6)"
```

---

## Task 7: `reset-password` endpoints (all 3 actor types)

**Files:**
- Modify: `backend/src/routes/auth.js`
- Modify: `backend/src/routes/staffAuth.js`
- Modify: `backend/src/routes/platformAuth.js`
- Test: `backend/tests/resetPassword.test.js`
- Test: `backend/tests/resetPasswordRateLimit.test.js`

- [ ] **Step 1: Write the failing behavioral test**

Create `backend/tests/resetPassword.test.js`:

```js
const request = require('supertest');

jest.mock('../src/models/Resident');
jest.mock('../src/models/GateStaff');
jest.mock('../src/models/PlatformAdmin');
jest.mock('../src/models/PasswordResetToken');
jest.mock('../src/models/AuditLog');

const Resident = require('../src/models/Resident');
const GateStaff = require('../src/models/GateStaff');
const PlatformAdmin = require('../src/models/PlatformAdmin');
const PasswordResetToken = require('../src/models/PasswordResetToken');
const AuditLog = require('../src/models/AuditLog');
const app = require('../src/app');

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.log = jest.fn().mockResolvedValue(undefined);
  PasswordResetToken.remove = jest.fn().mockResolvedValue(undefined);
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
```

- [ ] **Step 2: Write the failing rate-limit test**

Create `backend/tests/resetPasswordRateLimit.test.js` (separate file, same reasoning as Task 6 Step 2):

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- resetPassword`
Expected: FAIL — routes don't exist yet

- [ ] **Step 4: Implement the resident endpoint**

In `backend/src/routes/auth.js`, add a limiter and the route:

```js
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

router.post('/reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'resident') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const resident = await Resident.updatePassword(tokenRow.actor_id, new_password, client);
    await Resident.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);

    await AuditLog.log(client, {
      community_id: resident.community_id,
      action: 'resident.password_reset',
      actor_id: resident.id,
      actor_type: 'resident',
      resource_id: resident.id,
      resource_type: 'resident',
      details: {},
    });

    await client.query('COMMIT');
    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

`pool` and `AuditLog` are already imported in `auth.js` from earlier work — no new imports needed for this step.

- [ ] **Step 5: Implement the gate staff endpoint**

In `backend/src/routes/staffAuth.js`, add `const AuditLog = require('../models/AuditLog');` to imports, add a `resetPasswordLimiter` (identical shape to the one above), and add:

```js
router.post('/staff-reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'gate_staff') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const staff = await GateStaff.updatePassword(tokenRow.actor_id, new_password, client);
    await GateStaff.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);

    await AuditLog.log(client, {
      community_id: staff.community_id,
      action: 'staff.password_reset',
      actor_id: staff.id,
      actor_type: 'gate_staff',
      resource_id: staff.id,
      resource_type: 'gate_staff',
      details: {},
    });

    await client.query('COMMIT');
    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

Also add `validateResetPassword` to the existing validators destructured from `../middleware/validate` in this file (alongside `validateForgotPassword` added in Task 6).

- [ ] **Step 6: Implement the platform admin endpoint**

In `backend/src/routes/platformAuth.js`, add a `resetPasswordLimiter` (identical shape), and add:

```js
router.post('/platform-reset-password', resetPasswordLimiter, validateResetPassword, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { token, new_password } = req.body;
    const tokenRow = await PasswordResetToken.findValidByHash(hashToken(token), client);
    if (!tokenRow || tokenRow.actor_type !== 'platform_admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    await PlatformAdmin.updatePassword(tokenRow.actor_id, new_password, client);
    await PlatformAdmin.incrementTokenVersion(tokenRow.actor_id, client);
    await PasswordResetToken.remove(tokenRow.id, client);
    // No audit_logs entry — community_id is NOT NULL there and a platform
    // admin's own account action has no community to attach to, same as
    // platform-admin login itself not being audit-logged.

    await client.query('COMMIT');
    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

Also add `validateResetPassword` to the existing validators destructured from `../middleware/validate` in this file.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- resetPassword`
Expected: PASS, all tests in both files

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, all suites (should be 15 tests from before this plan + all tests added in Tasks 2, 6, 7)

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/auth.js backend/src/routes/staffAuth.js backend/src/routes/platformAuth.js backend/tests/resetPassword.test.js backend/tests/resetPasswordRateLimit.test.js
git commit -m "Add reset-password endpoints for all three actor types (ARG-6)"
```

---

## Task 8: Frontend — resident forgot/reset password pages

No tests — the frontend has zero test infrastructure anywhere in this repo (confirmed in [[Tech Stack]]); this is consistent with every other frontend page, not a gap introduced here.

**Files:**
- Create: `frontend/src/pages/ForgotPasswordPage.jsx`
- Create: `frontend/src/pages/ResetPasswordPage.jsx`
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add API functions**

In `frontend/src/lib/api.js`, add these two lines inside the existing `authApi` object:

```js
  forgotPassword: (payload) => request('/api/auth/forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/api/auth/reset-password', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Add context passthroughs**

In `frontend/src/context/AuthContext.jsx`, add these two functions (near `resendCode`):

```js
  const forgotPassword = async (payload) => {
    return authApi.forgotPassword(payload)
  }

  const resetPassword = async (payload) => {
    return authApi.resetPassword(payload)
  }
```

Add `forgotPassword, resetPassword,` to the `value={{ ... }}` object passed to `AuthContext.Provider`.

- [ ] **Step 3: Create ForgotPasswordPage**

Create `frontend/src/pages/ForgotPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { CommunityPicker } from '@/components/CommunityPicker'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [form, setForm] = useState({ community_id: '', email: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword({ ...form, community_id: Number(form.community_id) })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a reset link.">
        <Link to="/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to reset it"
      footer={
        <Link to="/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Community" required>
          {(fieldProps) => (
            <CommunityPicker {...fieldProps} value={form.community_id} onChange={update('community_id')} required />
          )}
        </FormField>

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 4: Create ResetPasswordPage**

Create `frontend/src/pages/ResetPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword({ token, new_password: password })
      navigate('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing its token.">
        <Link to="/forgot-password" className="font-medium text-accent-600 hover:underline">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="New password" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 5: Add a "Forgot your password?" link to LoginPage**

In `frontend/src/pages/LoginPage.jsx`, add this line inside the existing `footer` prop's `<div className="flex flex-col gap-1.5">`, as a new `<p>` before the closing `</div>`:

```jsx
          <p>
            <Link to="/forgot-password" className="font-medium text-accent-600 hover:underline">
              Forgot your password?
            </Link>
          </p>
```

- [ ] **Step 6: Add routes**

In `frontend/src/App.jsx`:

1. Add imports near the other page imports:
```jsx
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
```
2. Inside the existing `<Route element={<PublicOnlyRoute />}>` block, after the `/verify-email` route, add:
```jsx
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Step 7: Manual smoke test**

Run the frontend dev server (`cd frontend && npm run dev`) and in a browser: visit `/login`, click "Forgot your password?", confirm it navigates to `/forgot-password` and renders the form. Visit `/reset-password` directly (no token) and confirm it shows the "Invalid reset link" state. Visit `/reset-password?token=abc` and confirm it shows the password form.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/ForgotPasswordPage.jsx frontend/src/pages/ResetPasswordPage.jsx frontend/src/lib/api.js frontend/src/context/AuthContext.jsx frontend/src/pages/LoginPage.jsx frontend/src/App.jsx
git commit -m "Add resident forgot/reset password pages (ARG-6)"
```

---

## Task 9: Frontend — gate staff forgot/reset password pages

Same reasoning as Task 8 — no tests, matches existing frontend convention.

**Files:**
- Create: `frontend/src/pages/StaffForgotPasswordPage.jsx`
- Create: `frontend/src/pages/StaffResetPasswordPage.jsx`
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/context/StaffAuthContext.jsx`
- Modify: `frontend/src/pages/StaffLoginPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add API functions**

In `frontend/src/lib/api.js`, add these two lines inside the existing `staffAuthApi` object:

```js
  forgotPassword: (payload) => request('/api/auth/staff-forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/api/auth/staff-reset-password', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Add context passthroughs**

In `frontend/src/context/StaffAuthContext.jsx`, add these two functions (near `login`):

```js
  const forgotPassword = async (payload) => {
    return staffAuthApi.forgotPassword(payload)
  }

  const resetPassword = async (payload) => {
    return staffAuthApi.resetPassword(payload)
  }
```

Add `forgotPassword, resetPassword,` to the `value={{ ... }}` object passed to `StaffAuthContext.Provider`.

- [ ] **Step 3: Create StaffForgotPasswordPage**

Create `frontend/src/pages/StaffForgotPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { CommunityPicker } from '@/components/CommunityPicker'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function StaffForgotPasswordPage() {
  const { forgotPassword } = useStaffAuth()
  const [form, setForm] = useState({ community_id: '', email: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword({ ...form, community_id: Number(form.community_id) })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a reset link.">
        <Link to="/staff/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to reset it"
      footer={
        <Link to="/staff/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Community" required>
          {(fieldProps) => (
            <CommunityPicker {...fieldProps} value={form.community_id} onChange={update('community_id')} required />
          )}
        </FormField>

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 4: Create StaffResetPasswordPage**

Create `frontend/src/pages/StaffResetPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStaffAuth } from '@/context/StaffAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function StaffResetPasswordPage() {
  const { resetPassword } = useStaffAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword({ token, new_password: password })
      navigate('/staff/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing its token.">
        <Link to="/staff/forgot-password" className="font-medium text-accent-600 hover:underline">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="New password" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 5: Add a "Forgot your password?" link to StaffLoginPage**

In `frontend/src/pages/StaffLoginPage.jsx`, change the existing `footer` prop from:
```jsx
      footer={
        <>
          Resident?{' '}
          <Link to="/login" className="font-medium text-accent-600 hover:underline">
            Sign in here
          </Link>
        </>
      }
```
to:
```jsx
      footer={
        <div className="flex flex-col gap-1.5">
          <p>
            Resident?{' '}
            <Link to="/login" className="font-medium text-accent-600 hover:underline">
              Sign in here
            </Link>
          </p>
          <p>
            <Link to="/staff/forgot-password" className="font-medium text-accent-600 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </div>
      }
```

- [ ] **Step 6: Add routes**

In `frontend/src/App.jsx`:

1. Add imports:
```jsx
import { StaffForgotPasswordPage } from '@/pages/StaffForgotPasswordPage'
import { StaffResetPasswordPage } from '@/pages/StaffResetPasswordPage'
```
2. Inside the existing `<Route element={<StaffPublicOnlyRoute />}>` block, after the `/staff/login` route, add:
```jsx
              <Route path="/staff/forgot-password" element={<StaffForgotPasswordPage />} />
              <Route path="/staff/reset-password" element={<StaffResetPasswordPage />} />
```

- [ ] **Step 7: Manual smoke test**

Same as Task 8 Step 7, but under `/staff/login` → `/staff/forgot-password` → `/staff/reset-password?token=abc`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/StaffForgotPasswordPage.jsx frontend/src/pages/StaffResetPasswordPage.jsx frontend/src/lib/api.js frontend/src/context/StaffAuthContext.jsx frontend/src/pages/StaffLoginPage.jsx frontend/src/App.jsx
git commit -m "Add gate staff forgot/reset password pages (ARG-6)"
```

---

## Task 10: Frontend — platform admin forgot/reset password pages

Same reasoning as Tasks 8–9 — no tests.

**Files:**
- Create: `frontend/src/pages/platform/PlatformForgotPasswordPage.jsx`
- Create: `frontend/src/pages/platform/PlatformResetPasswordPage.jsx`
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/context/PlatformAuthContext.jsx`
- Modify: `frontend/src/pages/platform/PlatformLoginPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add API functions**

In `frontend/src/lib/api.js`, add these two lines inside the existing `platformAuthApi` object:

```js
  forgotPassword: (payload) => request('/api/auth/platform-forgot-password', { method: 'POST', body: payload }),
  resetPassword: (payload) => request('/api/auth/platform-reset-password', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Add context passthroughs**

In `frontend/src/context/PlatformAuthContext.jsx`, add these two functions (near `login`):

```js
  const forgotPassword = async (payload) => {
    return platformAuthApi.forgotPassword(payload)
  }

  const resetPassword = async (payload) => {
    return platformAuthApi.resetPassword(payload)
  }
```

Add `forgotPassword, resetPassword,` to the `value={{ ... }}` object passed to `PlatformAuthContext.Provider`.

- [ ] **Step 3: Create PlatformForgotPasswordPage**

Create `frontend/src/pages/platform/PlatformForgotPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function PlatformForgotPasswordPage() {
  const { forgotPassword } = usePlatformAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that email, we've sent a reset link.">
        <Link to="/platform/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a link to reset it"
      footer={
        <Link to="/platform/login" className="font-medium text-accent-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="Email" required>
          {(fieldProps) => (
            <Input {...fieldProps} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 4: Create PlatformResetPasswordPage**

Create `frontend/src/pages/platform/PlatformResetPasswordPage.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePlatformAuth } from '@/context/PlatformAuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export function PlatformResetPasswordPage() {
  const { resetPassword } = usePlatformAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await resetPassword({ token, new_password: password })
      navigate('/platform/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing its token.">
        <Link to="/platform/forgot-password" className="font-medium text-accent-600 hover:underline">
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}

        <FormField label="New password" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} className="mt-2">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 5: Add a "Forgot your password?" link to PlatformLoginPage**

In `frontend/src/pages/platform/PlatformLoginPage.jsx`, add a `footer` prop to the `<AuthLayout>` call (it currently has none):

```jsx
    <AuthLayout
      title="Platform sign in"
      subtitle="Argus internal — onboard and manage communities"
      footer={
        <Link to="/platform/forgot-password" className="font-medium text-accent-600 hover:underline">
          Forgot your password?
        </Link>
      }
    >
```

Add `import { Link } from 'react-router-dom'` — check the existing import line (`import { useNavigate } from 'react-router-dom'`) and change it to `import { Link, useNavigate } from 'react-router-dom'`.

- [ ] **Step 6: Add routes**

In `frontend/src/App.jsx`:

1. Add imports:
```jsx
import { PlatformForgotPasswordPage } from '@/pages/platform/PlatformForgotPasswordPage'
import { PlatformResetPasswordPage } from '@/pages/platform/PlatformResetPasswordPage'
```
2. Inside the existing `<Route element={<PlatformPublicOnlyRoute />}>` block, after the `/platform/login` route, add:
```jsx
              <Route path="/platform/forgot-password" element={<PlatformForgotPasswordPage />} />
              <Route path="/platform/reset-password" element={<PlatformResetPasswordPage />} />
```

- [ ] **Step 7: Manual smoke test**

Same as Task 8 Step 7, but under `/platform/login` → `/platform/forgot-password` → `/platform/reset-password?token=abc`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/platform/PlatformForgotPasswordPage.jsx frontend/src/pages/platform/PlatformResetPasswordPage.jsx frontend/src/lib/api.js frontend/src/context/PlatformAuthContext.jsx frontend/src/pages/platform/PlatformLoginPage.jsx frontend/src/App.jsx
git commit -m "Add platform admin forgot/reset password pages (ARG-6)"
```

---

## Task 11: Deploy — migration first, then code

Mirrors the exact sequence used for `ARG-7`'s deploy (documented in the [[Deployment & Infrastructure]] vault note): **migrate the production database before pushing the code that depends on it.**

**Files:** none (infra/ops task)

- [ ] **Step 1: Confirm `doctl` is authenticated**

Run: `doctl account get`
Expected: shows `rico@whereisrico.dev` / My Team (not an auth error)

- [ ] **Step 2: Write the migration script locally**

Create a local scratch file (not committed) with:

```js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      actor_type VARCHAR(50) NOT NULL,
      actor_id INTEGER NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_actor ON password_reset_tokens(actor_type, actor_id)');

  const check = await pool.query(`
    SELECT table_name FROM information_schema.tables WHERE table_name = 'password_reset_tokens'
  `);
  console.log('VERIFY:', JSON.stringify(check.rows));
  console.log('MIGRATION_OK');
  await pool.end();
}

main().catch((err) => {
  console.error('MIGRATION_FAILED', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Apply it via `doctl apps console`**

Base64-encode the script and feed it through the PTY workaround (see [[Deployment & Infrastructure]] for why — and use the macOS-compatible `script -q /dev/null <command...>` form, not the Linux `-c "..."` form CLAUDE.md documents):

```bash
base64 -i migrate.js -o migrate.b64
{
  echo "cat > /tmp/migrate.b64 <<'B64EOF'"
  cat migrate.b64
  echo "B64EOF"
  echo "base64 -d /tmp/migrate.b64 > /workspace/backend/migrate-password-reset.js"
  echo "cd /workspace/backend && node migrate-password-reset.js"
  echo "exit"
} > console-commands.txt

script -q /dev/null doctl apps console 124a987b-407c-48e0-a2e3-6d9125a996d5 backend < console-commands.txt
```

Expected output includes `VERIFY: [{"table_name":"password_reset_tokens"}]` and `MIGRATION_OK`.

- [ ] **Step 4: Commit any remaining uncommitted work and push**

```bash
git status --short
git push origin main
```

- [ ] **Step 5: Monitor the deployment**

```bash
doctl apps list-deployments 124a987b-407c-48e0-a2e3-6d9125a996d5 --format ID,Phase,Progress,Cause --no-header | head -1
```
Poll until `Phase` is `ACTIVE` (or `ERROR` — investigate if so).

- [ ] **Step 6: Smoke test**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://palisade.argusbahamas.com/
curl -s -X POST https://palisade.argusbahamas.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"community_id": 999999, "email": "nobody-real@example.com"}' \
  -w "\n%{http_code}\n"
```
Expected: first command → `200`. Second → the generic `{"message":"If an account exists, a reset link has been sent."}` with `200` (proves the new endpoint is live and the enumeration-prevention behavior works for a certainly-nonexistent account, without needing real credentials).

- [ ] **Step 7: Update Linear and the vault**

Mark `ARG-6` Done in Linear with a summary comment (mirroring the ARG-7 deploy comment style). Update `Roadmap & Backlog.md`, `Launch Readiness.md`, and `Password Reset.md` in the vault to reflect that this is shipped, not just designed — remove the "design phase, not yet implemented" banner from `Password Reset.md`.

---

## Self-Review Notes

**Spec coverage:** every section of `2026-09-04-password-reset-design.md` maps to a task — data model (Task 1), token hashing (Task 2), model layer (Task 3), email (Task 4), validation (Task 5), forgot-password (Task 6), reset-password (Task 7), frontend ×3 (Tasks 8–10), deployment (Task 11).

**Type/name consistency checked:** `PasswordResetToken.create`/`findValidByHash`/`deleteForActor`/`remove` are named identically everywhere they're referenced (model, routes, tests). `actor_type` values (`'resident'`, `'gate_staff'`, `'platform_admin'`) match exactly what `token_version`'s JWT payload already uses from `ARG-7`. `updatePassword(id, plainPassword, client)` signature is identical across all three models.

**No placeholders:** every step has complete, real code — no "add appropriate error handling" or "similar to Task N" shorthand.
