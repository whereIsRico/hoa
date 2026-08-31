# Email Verification + Admin Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registration becomes a hard-gated, email-verified flow (6-digit code via Resend), every admin resident gets notified once a resident verifies, and the login endpoint closes the bypass where an unverified resident could otherwise just log in directly.

**Architecture:** Two new backend endpoints (`verify-email`, `resend-code`) plus modifications to the existing `register`/`login` endpoints in `backend/src/routes/auth.js`. One new table (`email_verifications`) and one new column (`residents.email_verified`). A new `backend/src/utils/email.js` wraps the Resend SDK. On the frontend, a new `VerifyEmailPage` sits between registration and the dashboard; `AuthContext` stops setting a session on `register()` and gains `verifyEmail()`/`resendCode()`.

**Tech Stack:** Node/Express + `pg` (backend), Vite/React + React Router (frontend), Postgres, Resend (new), `express-rate-limit` (new).

**Spec:** `docs/superpowers/specs/2026-08-30-email-verification-design.md`

## Global Constraints

- No automated test suite exists anywhere in this repo. Every task's verification is manual, against a real local Postgres + backend + frontend — the established convention for this whole project. Do not introduce a test framework.
- Local dev DB: `PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev`.
- Local backend: `cd backend && npm start` (not `npm run dev` — `nodemon` is listed in `package.json` but isn't actually installed in this environment).
- Local frontend: `cd frontend && VITE_API_URL=http://localhost:3000 npm run dev` — the repo's `frontend/.env` points at a stale LAN IP from phone-testing; the env override is required every time, do not edit `frontend/.env` to "fix" this.
- Playwright browser checks: no global Playwright install exists. Use a throwaway local install (`npm install playwright` in a scratch directory) and launch with `executablePath: '/usr/bin/chromium'` (the system Chromium binary — Playwright's own bundled browser isn't downloaded in this environment).
- Multi-write routes use the existing `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` (in catch) / `client.release()` (in finally) transaction shape already used throughout `backend/src/routes/admin.js` and `backend/src/routes/platform.js` — copy that shape exactly, don't invent a different one.
- Hashing happens inside models (mirrors `Resident.create` hashing a plain password internally) — routes never call `utils/password.js` directly.
- Community-scoped lookups that don't find a match return 404, never leak whether an email exists in a *different* community — matches every existing route in this codebase.
- Secrets never get real values committed to `.do/app.yaml` — that file keeps placeholder values (`REPLACE_ME_IN_DASHBOARD`), matching the existing `JWT_SECRET` entry; real values are set on the live DO app via `doctl apps update` built from `doctl apps spec get`, never by pushing the repo file's placeholder over the live spec.

---

## Task 1: Local DB schema migration

**Files:**
- Modify: `schema.sql`

**Interfaces:**
- Produces: `residents.email_verified` (boolean column), `email_verifications` table (`id, resident_id, code_hash, expires_at, created_at`) — every later backend task reads/writes these.

- [ ] **Step 1: Add the column and table to `schema.sql`**

In the `residents` table definition, add the new column right after `is_approved`:

```sql
CREATE TABLE residents (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  unit_number VARCHAR(50),
  is_approved BOOLEAN DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  guest_limit_per_month INTEGER DEFAULT 10,
  role VARCHAR(50) DEFAULT 'resident',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, email)
);
```

Add the new table right after the `residents` table block (before `gate_staff`):

```sql
-- Email verification codes for new resident registrations. A separate
-- table (not columns on residents) so "resend" is just a new row — no
-- in-place overwrite juggling, matching the manual_contacts precedent
-- of purpose-built tables over overloading an existing one.
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id),
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Add the index alongside the other indexes at the bottom of the file:

```sql
CREATE INDEX idx_email_verifications_resident ON email_verifications(resident_id);
```

- [ ] **Step 2: Apply the migration to the local dev DB**

The local `hoa_dev` database already exists with data from earlier sessions (re-running all of `schema.sql` would fail on `CREATE TABLE` for tables that already exist). Apply just the incremental change:

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "
ALTER TABLE residents ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
UPDATE residents SET email_verified = true;
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id),
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_verifications_resident ON email_verifications(resident_id);
"
```

The `UPDATE residents SET email_verified = true` backfills every existing local test account (they predate this feature — same reasoning documented in the spec's "Migration sequencing" section for prod) so local login testing in later tasks isn't broken.

- [ ] **Step 3: Verify**

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "\d residents" | grep email_verified
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "\d email_verifications"
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "SELECT id, email, email_verified FROM residents;"
```

Expected: `email_verified` column shown as `boolean not null default false` on `residents`; `email_verifications` table described with its 5 columns; every existing resident row shows `email_verified = t`.

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "Add email_verified column and email_verifications table"
```

---

## Task 2: Backend data layer — `EmailVerification` model, `Resident.js` additions, verification-code util

**Files:**
- Create: `backend/src/models/EmailVerification.js`
- Create: `backend/src/utils/verificationCode.js`
- Modify: `backend/src/models/Resident.js`

**Interfaces:**
- Consumes: `email_verifications` table, `residents.email_verified` (Task 1).
- Produces: `EmailVerification.create(residentId, plainCode, client?) -> row`, `EmailVerification.findLatestForResident(residentId, client?) -> row|null`, `EmailVerification.matchesCode(verification, plainCode) -> boolean`, `EmailVerification.remove(id, client?) -> void`; `Resident.markEmailVerified(id, client?) -> resident`, `Resident.listAdminEmailsForCommunity(communityId, client?) -> string[]`; `generateCode() -> string` (always exactly 6 digits). These are what Task 4-7's routes call directly.

- [ ] **Step 1: Write `backend/src/utils/verificationCode.js`**

```js
const crypto = require('crypto');

// Always exactly 6 digits — crypto.randomInt(100000, 1000000) can never
// produce a value that would display with a dropped leading zero, unlike
// a naive Math.random()-based approach.
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { generateCode };
```

- [ ] **Step 2: Write `backend/src/models/EmailVerification.js`**

```js
const pool = require('../config/db');
const password = require('../utils/password');

const CODE_TTL_MS = 15 * 60 * 1000;

// Hashes internally, mirroring Resident.create's treatment of the plain
// password — callers never touch utils/password.js directly.
async function create(residentId, plainCode, client = pool) {
  const code_hash = await password.hash(plainCode);
  const expires_at = new Date(Date.now() + CODE_TTL_MS);
  const { rows } = await client.query(
    `INSERT INTO email_verifications (resident_id, code_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, resident_id, code_hash, expires_at, created_at`,
    [residentId, code_hash, expires_at]
  );
  return rows[0];
}

async function findLatestForResident(residentId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, resident_id, code_hash, expires_at, created_at
     FROM email_verifications WHERE resident_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [residentId]
  );
  return rows[0] || null;
}

async function matchesCode(verification, plainCode) {
  return password.compare(plainCode, verification.code_hash);
}

async function remove(id, client = pool) {
  await client.query('DELETE FROM email_verifications WHERE id = $1', [id]);
}

module.exports = { create, findLatestForResident, matchesCode, remove };
```

- [ ] **Step 3: Modify `backend/src/models/Resident.js`**

Add `email_verified` to `PUBLIC_COLUMNS` (currently at line 5-8):

```js
const PUBLIC_COLUMNS = `
  id, community_id, email, first_name, last_name, phone, unit_number,
  is_approved, email_verified, guest_limit_per_month, role, created_at, updated_at
`;
```

Add two new functions right after `updateApproval` (currently ends at line 135, right before `async function remove`):

```js
async function markEmailVerified(id, client = pool) {
  const { rows } = await client.query(
    `UPDATE residents SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function listAdminEmailsForCommunity(communityId, client = pool) {
  const { rows } = await client.query(
    "SELECT email FROM residents WHERE community_id = $1 AND role = 'admin'",
    [communityId]
  );
  return rows.map((r) => r.email);
}
```

Add both to `module.exports` (currently lines 141-154):

```js
module.exports = {
  emailExistsInCommunity,
  create,
  findByEmailAndCommunity,
  findById,
  findByIdInCommunity,
  listForCommunity,
  countAdminsInCommunity,
  remove,
  updateRole,
  updateApproval,
  markEmailVerified,
  listAdminEmailsForCommunity,
  updateProfile,
  verifyPassword,
};
```

- [ ] **Step 4: Verify with a throwaway script against the local dev DB**

```bash
cd backend
cat > /tmp/verify-task2.js << 'EOF'
const pool = require('./src/config/db');
const Resident = require('./src/models/Resident');
const EmailVerification = require('./src/models/EmailVerification');
const { generateCode } = require('./src/utils/verificationCode');

async function main() {
  const code = generateCode();
  console.log('generated code:', code, 'length:', code.length, 'is 6 digits:', /^\d{6}$/.test(code));

  const { rows } = await pool.query("SELECT id FROM residents WHERE role = 'admin' LIMIT 1");
  const residentId = rows[0].id;

  const verification = await EmailVerification.create(residentId, code);
  console.log('created verification row:', verification.id, 'expires_at:', verification.expires_at);

  const latest = await EmailVerification.findLatestForResident(residentId);
  console.log('found latest:', latest.id === verification.id);

  console.log('correct code matches:', await EmailVerification.matchesCode(latest, code));
  console.log('wrong code matches:', await EmailVerification.matchesCode(latest, '000000'));

  const verified = await Resident.markEmailVerified(residentId);
  console.log('email_verified now true:', verified.email_verified === true);

  const adminEmails = await Resident.listAdminEmailsForCommunity(verified.community_id);
  console.log('admin emails:', adminEmails);

  await EmailVerification.remove(verification.id);
  const afterRemove = await EmailVerification.findLatestForResident(residentId);
  console.log('removed cleanly:', afterRemove === null);

  // Restore: this script shouldn't leave the admin test account un-re-verifiable for later tasks
  await pool.query('UPDATE residents SET email_verified = true WHERE id = $1', [residentId]);

  await pool.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
EOF
node /tmp/verify-task2.js
```

Expected output: `is 6 digits: true`, `found latest: true`, `correct code matches: true`, `wrong code matches: false`, `email_verified now true: true`, `admin emails:` a non-empty array, `removed cleanly: true`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/EmailVerification.js backend/src/utils/verificationCode.js backend/src/models/Resident.js
git commit -m "Add EmailVerification model and Resident additions for email verification"
```

---

## Task 3: Email sending — Resend integration

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/utils/email.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM` env vars (already set in `backend/.env` locally, not in git).
- Produces: `sendVerificationCode(to, code) -> Promise<void>` (throws on failure), `sendAdminNotification(adminEmails, { residentName, communityName }) -> Promise<void>` (throws on failure — callers decide whether to swallow it). Tasks 4-6 call these directly.

- [ ] **Step 1: Add dependencies**

```bash
cd backend
npm install resend express-rate-limit
```

- [ ] **Step 2: Write `backend/src/utils/email.js`**

```js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM;

async function sendVerificationCode(to, code) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Palisade verification code',
    text: `Your Palisade verification code is ${code}. It expires in 15 minutes.`,
  });
  if (error) throw new Error(error.message || 'Failed to send verification email');
}

async function sendAdminNotification(adminEmails, { residentName, communityName }) {
  if (adminEmails.length === 0) return;
  const { error } = await resend.emails.send({
    from: FROM,
    to: adminEmails,
    subject: `New resident awaiting approval — ${communityName}`,
    text: `${residentName} registered as a resident of ${communityName} and is waiting for your approval. Review it at https://palisade.whereisrico.dev/dashboard/admin/residents`,
  });
  if (error) throw new Error(error.message || 'Failed to send admin notification email');
}

module.exports = { sendVerificationCode, sendAdminNotification };
```

- [ ] **Step 3: Add placeholders to `backend/.env.example`**

Add after the `JWT_SECRET` line:

```
# Email (Resend)
RESEND_API_KEY=change_me
EMAIL_FROM=notifications@yourdomain.example
```

- [ ] **Step 4: Verify by actually sending**

`backend/.env` already has real `RESEND_API_KEY`/`EMAIL_FROM` values set. The sending domain's DNS was just configured and may or may not have finished Resend's own verification check yet — this step tolerates that, it does not require it to already be verified.

```bash
cd backend
node -e "
require('dotenv').config();
const { sendVerificationCode } = require('./src/utils/email');
sendVerificationCode('rico@whereisrico.dev', '123456')
  .then(() => console.log('SENT_OK'))
  .catch((err) => console.log('SEND_FAILED:', err.message));
"
```

Two acceptable outcomes:
- `SENT_OK` — domain is verified, sending genuinely works. Check the inbox at `rico@whereisrico.dev` to confirm the email actually arrived (not just that the API accepted it).
- `SEND_FAILED: The palisade.whereisrico.dev domain is not verified...` — the code path itself is correct (it reached Resend's API and got a well-formed, expected error back, not a JS/config bug). Note which outcome occurred; if it's this one, re-run this exact command later (verification can take a few minutes to hours) before relying on Task 10's real end-to-end test.

Anything else (a different error message, a thrown exception before even reaching Resend, `RESEND_API_KEY is not defined`, etc.) is a real bug in this task — fix it before moving on.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/utils/email.js backend/.env.example
git commit -m "Add Resend email-sending utility"
```

---

## Task 4: `POST /api/auth/register` — hard-gate behind email verification

**Files:**
- Modify: `backend/src/middleware/validate.js`
- Modify: `backend/src/routes/auth.js`

**Interfaces:**
- Consumes: `EmailVerification.create`, `sendVerificationCode` (Tasks 2-3).
- Produces: `POST /api/auth/register` now returns `201 { email, community_id }` with **no token** (breaking change from today's `{ resident, token }`). Task 8 (frontend) depends on this exact response shape.

- [ ] **Step 1: Add `validateVerifyEmail` and `validateResendCode` to `backend/src/middleware/validate.js`**

(Added now, used starting Task 5 — grouping validator additions here since they're trivial and this task already touches this file's neighborhood conceptually; Task 5/6 reference them.)

Add after `validateLogin` (ends at line 47):

```js
function validateVerifyEmail(req, res, next) {
  const { community_id, email, code } = req.body;
  const errors = [];

  if (community_id === undefined || !Number.isInteger(Number(community_id))) {
    errors.push('community_id is required and must be an integer');
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push('A valid email is required');
  }
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    errors.push('code is required and must be 6 digits');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

function validateResendCode(req, res, next) {
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
```

Add both to `module.exports` (currently lines 395-419) — insert right after `validateLogin,`:

```js
module.exports = {
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateResendCode,
  validateProfileUpdate,
  PROFILE_EDITABLE_FIELDS,
  validateGuestCreate,
  validateGuestUpdate,
  validateGuestDeny,
  GUEST_EDITABLE_FIELDS,
  GUEST_STATUS_VALUES,
  RESIDENT_SETTABLE_STATUS_VALUES,
  validateStaffCreate,
  validateRoleChange,
  RESIDENT_ROLE_VALUES,
  validateApprovalChange,
  validatePlatformLogin,
  validateCommunityOnboard,
  SUBSCRIPTION_TIERS,
  validatePolicyUpdate,
  validateBillingStatus,
  BILLING_STATUS_VALUES,
  validateContactCreate,
  validateContactUpdate,
  CONTACT_EDITABLE_FIELDS,
};
```

- [ ] **Step 2: Rewrite `backend/src/routes/auth.js`**

Replace the entire file (this task changes `register` and sets up shared imports Tasks 5-7 build on; writing the full file now keeps the diff coherent — Tasks 5-7 will add to it):

```js
const express = require('express');
const rateLimit = require('express-rate-limit');

const pool = require('../config/db');
const Resident = require('../models/Resident');
const EmailVerification = require('../models/EmailVerification');
const Community = require('../models/Community');
const Policy = require('../models/Policy');
const AuditLog = require('../models/AuditLog');
const { sign } = require('../utils/jwt');
const { generateCode } = require('../utils/verificationCode');
const { sendVerificationCode, sendAdminNotification } = require('../utils/email');
const {
  validateRegister, validateLogin, validateVerifyEmail, validateResendCode,
} = require('../middleware/validate');

const router = express.Router();

function signToken(resident) {
  return sign({ id: resident.id, community_id: resident.community_id, role: resident.role, actorType: 'resident' });
}

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});

const resendCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait before requesting another code.' },
});

router.post('/register', validateRegister, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { community_id, email, password, first_name, last_name, phone, unit_number } = req.body;

    const exists = await Resident.emailExistsInCommunity(email, community_id);
    if (exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists for this community' });
    }

    // The community's configured monthly guest limit becomes this resident's
    // starting value — an admin can still override it per-resident later.
    const policy = await Policy.findByCommunity(community_id);

    const resident = await Resident.create({
      community_id, email, password, first_name, last_name, phone, unit_number,
      guest_limit_per_month: policy.max_guests_per_resident_per_month,
    }, client);

    const code = generateCode();
    await EmailVerification.create(resident.id, code, client);

    try {
      await sendVerificationCode(resident.email, code);
    } catch (sendErr) {
      // A resident should never end up in a state where an account exists
      // but no code was ever deliverable — roll the whole thing back.
      await client.query('ROLLBACK');
      return res.status(502).json({ error: 'Could not send verification email. Please try again.' });
    }

    await client.query('COMMIT');
    // No token here — this is the behavioral break from before: registration
    // no longer logs you in. The frontend routes to /verify-email next.
    res.status(201).json({ email: resident.email, community_id: resident.community_id });
  } catch (err) {
    await client.query('ROLLBACK');
    // FK violation on a bad community_id
    if (err.code === '23503') {
      return res.status(400).json({ error: 'community_id does not refer to an existing community' });
    }
    next(err);
  } finally {
    client.release();
  }
});

router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { community_id, email, password } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await Resident.verifyPassword(password, resident.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Closes the obvious bypass: without this, a resident who never
    // completes verification could just log in directly instead.
    if (!resident.email_verified) {
      return res.status(403).json({ error: 'Email not verified', code: 'EMAIL_UNVERIFIED' });
    }

    const token = signToken(resident);
    const { password_hash, ...safeResident } = resident;

    res.json({ resident: safeResident, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

Note: this is a checkpoint file — Task 5 adds `verify-email` and Task 6 adds `resend-code` as additional routes appended before `module.exports = router;`. The `login` route above already includes Task 7's change, since it's a small, low-risk addition being made now rather than as a separate near-empty diff later — Task 7 below is verification-only for it, not a further code change.

- [ ] **Step 3: Restart the local backend and verify registration no longer returns a token**

```bash
pkill -f "node src/index.js" 2>/dev/null; sleep 1
cd backend && npm start &
sleep 2
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{
  "community_id": 1, "email": "verify-test-1@example.com", "password": "Testpass123!",
  "first_name": "Verify", "last_name": "Test"
}'
```

Expected: `201` with exactly `{"email":"verify-test-1@example.com","community_id":1}` — no `token`, no `resident` object. If `RESEND_API_KEY`/`EMAIL_FROM` are set but the domain isn't Resend-verified yet, this call will instead return `502 {"error":"Could not send verification email. Please try again."}` — that's expected given Task 3's findings; if so, temporarily comment out the `try { await sendVerificationCode(...) }` block's rollback-and-return (just to unblock this one verification step) is **not** the fix — instead confirm Task 3's exact `SEND_FAILED` reason still applies, and revisit once domain verification completes before treating this task as done. Do not weaken the register endpoint's error handling to work around a still-unverified domain.

- [ ] **Step 4: Confirm the pending `email_verifications` row exists**

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "
SELECT r.email, r.email_verified, ev.expires_at
FROM residents r JOIN email_verifications ev ON ev.resident_id = r.id
WHERE r.email = 'verify-test-1@example.com';
"
```

Expected: one row, `email_verified = f`, `expires_at` roughly 15 minutes in the future.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/validate.js backend/src/routes/auth.js
git commit -m "Hard-gate registration behind email verification"
```

---

## Task 5: `POST /api/auth/verify-email`

**Files:**
- Modify: `backend/src/routes/auth.js`

**Interfaces:**
- Consumes: everything from Task 4's `auth.js`, plus `Community.findById(id) -> community|null` (already exists — read in `backend/src/models/Community.js`).
- Produces: `POST /api/auth/verify-email` returning `200 { resident, token }` on success — same shape `login` already returns. Task 8 (frontend) depends on this.

- [ ] **Step 1: Add the route to `backend/src/routes/auth.js`**

Insert between `register` and `login`:

```js
router.post('/verify-email', verifyEmailLimiter, validateVerifyEmail, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { community_id, email, code } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Resident not found' });
    }

    if (resident.email_verified) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email is already verified' });
    }

    const verification = await EmailVerification.findLatestForResident(resident.id, client);
    if (!verification || new Date(verification.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code expired or not found. Request a new one.' });
    }

    const matches = await EmailVerification.matchesCode(verification, code);
    if (!matches) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Incorrect code' });
    }

    const verifiedResident = await Resident.markEmailVerified(resident.id, client);
    await EmailVerification.remove(verification.id, client);

    await AuditLog.log(client, {
      community_id,
      action: 'resident.email_verified',
      actor_id: resident.id,
      actor_type: 'resident',
      resource_id: resident.id,
      resource_type: 'resident',
      details: { email: resident.email },
    });

    await client.query('COMMIT');

    // Best-effort from here — the resident already proved they own the
    // email, that's the part that must not roll back. A failed admin
    // notification is logged, not surfaced to the resident.
    try {
      const adminEmails = await Resident.listAdminEmailsForCommunity(community_id);
      const community = await Community.findById(community_id);
      await sendAdminNotification(adminEmails, {
        residentName: `${verifiedResident.first_name} ${verifiedResident.last_name}`,
        communityName: community?.name || 'their HOA',
      });
    } catch (notifyErr) {
      console.error('Admin notification failed:', notifyErr.message);
    }

    const token = signToken(verifiedResident);
    res.json({ resident: verifiedResident, token });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
```

- [ ] **Step 2: Restart the backend and verify the full loop with the local DB (bypassing real email — read the code straight from the DB, since Resend delivery is a separate concern already covered by Task 3)**

```bash
pkill -f "node src/index.js" 2>/dev/null; sleep 1
cd backend && npm start &
sleep 2

curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{
  "community_id": 1, "email": "verify-test-2@example.com", "password": "Testpass123!",
  "first_name": "Verify", "last_name": "Two"
}'
```

If this 502s because the domain still isn't Resend-verified (see Task 4 Step 3), get the plaintext code a different way for this test only — temporarily log it:

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "
SELECT ev.code_hash, r.id FROM email_verifications ev
JOIN residents r ON r.id = ev.resident_id
WHERE r.email = 'verify-test-2@example.com';
"
```

The `code_hash` is bcrypt — not reversible. If registration itself 502s on send failure, this task's *route logic* still needs verifying without a real send. Use this instead: temporarily insert a known code directly, bypassing `register`:

```bash
cd backend
node -e "
require('dotenv').config();
const pool = require('./src/config/db');
const Resident = require('./src/models/Resident');
const EmailVerification = require('./src/models/EmailVerification');
(async () => {
  const policy = { max_guests_per_resident_per_month: 10 };
  const resident = await Resident.create({
    community_id: 1, email: 'verify-test-2@example.com', password: 'Testpass123!',
    first_name: 'Verify', last_name: 'Two', guest_limit_per_month: policy.max_guests_per_resident_per_month,
  });
  await EmailVerification.create(resident.id, '111111');
  console.log('resident id:', resident.id, 'known code: 111111');
  await pool.end();
})();
"
```

Then, regardless of which path produced a resident + known code:

```bash
echo "--- wrong code (expect 401) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-2@example.com","code":"999999"}'

echo "--- correct code (expect 200 with resident+token) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-2@example.com","code":"111111"}'

echo "--- re-verify same account (expect 409) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-2@example.com","code":"111111"}'

echo "--- unknown email (expect 404) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d '{"community_id":1,"email":"nobody@example.com","code":"111111"}'
```

Expected: wrong code → `401 {"error":"Incorrect code"}`; correct code → `200` with a `resident` object (`email_verified: true`) and a `token`; re-verify → `409`; unknown email → `404`.

- [ ] **Step 3: Verify the audit log entry**

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "
SELECT action, actor_type, resource_type, details FROM audit_logs
WHERE action = 'resident.email_verified' ORDER BY id DESC LIMIT 1;
"
```

Expected: one row, `actor_type = resident`, `details` containing the test email.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "Add POST /api/auth/verify-email"
```

---

## Task 6: `POST /api/auth/resend-code`

**Files:**
- Modify: `backend/src/routes/auth.js`

**Interfaces:**
- Consumes: everything from Tasks 4-5.
- Produces: `POST /api/auth/resend-code` returning `200 { email, community_id }`. Task 8 (frontend) depends on this response shape.

- [ ] **Step 1: Add the route to `backend/src/routes/auth.js`**, right after `verify-email`:

```js
router.post('/resend-code', resendCodeLimiter, validateResendCode, async (req, res, next) => {
  try {
    const { community_id, email } = req.body;

    const resident = await Resident.findByEmailAndCommunity(email, community_id);
    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (resident.email_verified) {
      return res.status(409).json({ error: 'Email is already verified' });
    }

    const code = generateCode();
    await EmailVerification.create(resident.id, code);

    try {
      await sendVerificationCode(resident.email, code);
    } catch (sendErr) {
      return res.status(502).json({ error: 'Could not send verification email. Please try again.' });
    }

    res.status(200).json({ email: resident.email, community_id: resident.community_id });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Restart the backend and verify, including the rate limit**

```bash
pkill -f "node src/index.js" 2>/dev/null; sleep 1
cd backend && npm start &
sleep 2

echo "--- resend for the still-pending verify-test-1 account (expect 200 or 502, both are legitimate depending on domain verification status) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/resend-code -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-1@example.com"}'

echo "--- immediately again (expect 429, rate limited) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/resend-code -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-1@example.com"}'

echo "--- resend for the already-verified verify-test-2 account (expect 409) ---"
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/resend-code -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-2@example.com"}'
```

Expected: first call `200` or `502` (matches Task 3's finding on domain-verification status — either is correct, a wrong-error-message would not be); second call `429`; third call `409`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "Add POST /api/auth/resend-code"
```

---

## Task 7: Verify the login gate (no new code — Task 4 already wrote it)

**Files:** none (verification only)

**Interfaces:** none new.

- [ ] **Step 1: Confirm `verify-test-1@example.com` (still unverified from Task 4/6) is blocked from logging in directly**

If running as a fresh task/session (backend not already up from Task 6), start it first: `pkill -f "node src/index.js" 2>/dev/null; sleep 1; cd backend && npm start & sleep 2`.

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-1@example.com","password":"Testpass123!"}'
```

Expected: `403 {"error":"Email not verified","code":"EMAIL_UNVERIFIED"}` — not a token.

- [ ] **Step 2: Confirm `verify-test-2@example.com` (verified in Task 5) logs in normally**

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"community_id":1,"email":"verify-test-2@example.com","password":"Testpass123!"}'
```

Expected: `200` with a `resident`/`token` pair.

- [ ] **Step 3: Confirm cross-community isolation isn't broken by the verification layer**

The email-uniqueness check (`Resident.emailExistsInCommunity`) was already per-community before this feature; this step just confirms nothing added here regressed it. Register the *same* email address against a second community and confirm it doesn't collide with the community-1 accounts created in earlier tasks:

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "SELECT id, name FROM communities ORDER BY id;"
```

Using whatever second community id that lists (if only community 1 exists locally, skip this step — there's nothing to isolate against; note that in the task output rather than fabricating a second community):

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{
  "community_id": <second community id>, "email": "verify-test-2@example.com", "password": "Testpass123!",
  "first_name": "Cross", "last_name": "Community"
}'
```

Expected: `201`, not a `409` — the same email in a different community is a completely separate registration, exactly as it worked before this feature.

No commit — this task confirms behavior Task 4 already shipped.

---

## Task 8: Frontend — verification screen, wired from registration

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/pages/RegisterPage.jsx`
- Create: `frontend/src/pages/VerifyEmailPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `POST /api/auth/register` (Task 4, now `{email, community_id}` no token), `POST /api/auth/verify-email` (Task 5), `POST /api/auth/resend-code` (Task 6).
- Produces: `useAuth()` now exposes `verifyEmail(payload) -> Promise<void>` and `resendCode(payload) -> Promise<{email, community_id}>` alongside the existing `login`/`register`/`logout`. `register(payload)` now returns `Promise<{email, community_id}>` instead of setting a session. Task 9 (LoginPage) depends on `resendCode` existing on the context.

- [ ] **Step 1: Modify `frontend/src/lib/api.js`**

Add `code` capture to `ApiError` (currently lines 6-12):

```js
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'Request failed')
    this.status = status
    this.details = body?.details || null
    this.code = body?.code || null
  }
}
```

Add two methods to `authApi` (currently lines 35-38):

```js
export const authApi = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  verifyEmail: (payload) => request('/api/auth/verify-email', { method: 'POST', body: payload }),
  resendCode: (payload) => request('/api/auth/resend-code', { method: 'POST', body: payload }),
}
```

- [ ] **Step 2: Modify `frontend/src/context/AuthContext.jsx`**

Replace the `register` function (currently lines 44-49) and add two new ones, right after `login`:

```js
  const register = async (payload) => {
    // No session is set here — registration no longer logs you in. The
    // caller (RegisterPage) uses the returned { email, community_id } to
    // route into the verification screen.
    return authApi.register(payload)
  }

  const verifyEmail = async (payload) => {
    const { token: newToken, resident } = await authApi.verifyEmail(payload)
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setResident(resident)
  }

  const resendCode = async (payload) => {
    return authApi.resendCode(payload)
  }
```

Update the provider value (currently line 60):

```js
  return (
    <AuthContext.Provider
      value={{ token, resident, loading, login, register, verifyEmail, resendCode, logout, refreshResident, setResident }}
    >
      {children}
    </AuthContext.Provider>
  )
```

- [ ] **Step 3: Modify `frontend/src/pages/RegisterPage.jsx`**

Replace the `onSubmit` function (currently lines 23-43):

```js
  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setDetails(null)
    setSubmitting(true)
    try {
      const payload = { ...form, community_id: Number(form.community_id) }
      if (!payload.phone) delete payload.phone
      const { email, community_id } = await register(payload)
      navigate('/verify-email', { state: { email, community_id } })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setDetails(err.details)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }
```

(Only the two lines inside `try` after computing `payload` change — `navigate('/dashboard/guests')` becomes the `register`/`navigate('/verify-email', ...)` pair above.)

- [ ] **Step 4: Create `frontend/src/pages/VerifyEmailPage.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthLayout } from '@/components/AuthLayout'
import { FormField, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const RESEND_COOLDOWN_SECONDS = 60

// Reached two ways: from RegisterPage right after a code was sent, and
// from LoginPage when an unverified account tries to log in directly
// (see LoginPage.jsx). Both pass { email, community_id } via navigation
// state — there's no other way to know which pending registration this is.
export function VerifyEmailPage() {
  const { verifyEmail, resendCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { email, community_id } = location.state || {}

  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!email || !community_id) {
      navigate('/register', { replace: true })
    }
  }, [email, community_id, navigate])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await verifyEmail({ community_id, email, code })
      navigate('/dashboard/guests')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onResend = async () => {
    setError(null)
    setResendMessage(null)
    setResending(true)
    try {
      await resendCode({ community_id, email })
      setResendMessage('A new code has been sent.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!email || !community_id) return null

  return (
    <AuthLayout title="Verify your email" subtitle={`Enter the 6-digit code sent to ${email}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}
        {resendMessage && <Banner tone="success">{resendMessage}</Banner>}

        <FormField label="Verification code" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          )}
        </FormField>

        <Button type="submit" loading={submitting} disabled={code.length !== 6} className="mt-2">
          Verify
        </Button>

        <Button type="button" variant="ghost" onClick={onResend} loading={resending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
```

- [ ] **Step 5: Modify `frontend/src/App.jsx`**

Add the import (alongside the other page imports, e.g. right after `RegisterPage`):

```js
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
```

Add the route inside the existing `<Route element={<PublicOnlyRoute />}>` block (currently lines 42-45):

```jsx
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
            </Route>
```

- [ ] **Step 6: Build check**

```bash
cd frontend && npm run build
```

Expected: clean build, no errors.

- [ ] **Step 7: Verify the full flow live with Playwright, against the local backend from Task 6**

```bash
pkill -f "node src/index.js" 2>/dev/null; pkill -f "vite" 2>/dev/null; sleep 1
cd backend && (npm start &) ; sleep 2
cd ../frontend && (VITE_API_URL=http://localhost:3000 npm run dev &) ; sleep 2

mkdir -p /tmp/pw-scratch && cd /tmp/pw-scratch
npm install playwright
cat > test.mjs << 'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('select')?.options.length > 1, { timeout: 8000 });
await page.selectOption('select', { label: 'Lyford Cay' });
await page.fill('input[autocomplete="given-name"]', 'Playwright');
await page.fill('input[autocomplete="family-name"]', 'Test');
await page.fill('input[type="email"]', `pw-verify-${Date.now()}@example.com`);
await page.fill('input[type="password"]', 'Testpass123!');
await page.click('button[type="submit"]');

await page.waitForURL('**/verify-email', { timeout: 8000 });
console.log('LANDED ON VERIFY-EMAIL: true');

// direct dashboard access must still be blocked - no token exists yet
await page.goto('http://localhost:5173/dashboard/guests', { waitUntil: 'networkidle' });
console.log('BLOCKED FROM DASHBOARD (redirected to login):', page.url().includes('/login'));

await browser.close();
EOF
node test.mjs
```

Expected: `LANDED ON VERIFY-EMAIL: true`, `BLOCKED FROM DASHBOARD (redirected to login): true`. This confirms the hard gate holds even via direct navigation, not just UI flow.

`VerifyEmailPage` can only be reached with real `{email, community_id}` navigation state via an in-app `navigate()` call (a bare `page.goto('/verify-email')` has no state and immediately redirects to `/register` per Step 4's own `useEffect`). So drive it through the real register submission, then — since real sending may still be pending domain verification per Task 3 — overwrite that resident's just-created code with a known value using `EmailVerification.create` directly (this hashes correctly automatically; never hand-write a bcrypt hash string):

```bash
cat > /tmp/pw-scratch/test3.mjs << 'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const email = 'pw-full-loop@example.com';
await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('select')?.options.length > 1, { timeout: 8000 });
await page.selectOption('select', { label: 'Lyford Cay' });
await page.fill('input[autocomplete="given-name"]', 'Full');
await page.fill('input[autocomplete="family-name"]', 'Loop');
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', 'Testpass123!');
await page.click('button[type="submit"]');
await page.waitForURL('**/verify-email', { timeout: 8000 });
console.log('landed on verify-email, waiting for a known code to be seeded externally...');
await page.waitForTimeout(3000); // gives the shell command below time to run

await page.fill('input[maxlength="6"]', '111111'); // wrong
await page.click('button[type="submit"]');
await page.waitForTimeout(500);
const wrongCodeError = await page.locator('text=Incorrect code').isVisible();
console.log('WRONG CODE SHOWS ERROR:', wrongCodeError);

await page.fill('input[maxlength="6"]', '333333'); // the known code seeded below
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard/guests', { timeout: 8000 });
console.log('LANDED ON DASHBOARD AFTER VERIFY: true');

const pendingBanner = await page.locator('text=pending HOA approval').isVisible();
console.log('PENDING APPROVAL BANNER SHOWN (unchanged from before this feature):', pendingBanner);

await browser.close();
EOF
(cd /tmp/pw-scratch && node test3.mjs &)
sleep 1
cd /home/whereisrico/Projects/hoa/backend
node -e "
require('dotenv').config();
const pool = require('./src/config/db');
const EmailVerification = require('./src/models/EmailVerification');
(async () => {
  const { rows } = await pool.query(\"SELECT id FROM residents WHERE email = 'pw-full-loop@example.com'\");
  await EmailVerification.create(rows[0].id, '333333');
  console.log('seeded known code 333333 for pw-full-loop@example.com');
  await pool.end();
})();
"
wait
```

Expected: `WRONG CODE SHOWS ERROR: true`, `LANDED ON DASHBOARD AFTER VERIFY: true`, `PENDING APPROVAL BANNER SHOWN: true`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/api.js frontend/src/context/AuthContext.jsx frontend/src/pages/RegisterPage.jsx frontend/src/pages/VerifyEmailPage.jsx frontend/src/App.jsx
git commit -m "Add email verification screen, wired from registration"
```

---

## Task 9: Frontend — unverified-login redirect

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`

**Interfaces:**
- Consumes: `useAuth().resendCode` (Task 8), `ApiError.code` (Task 8).

- [ ] **Step 1: Modify `frontend/src/pages/LoginPage.jsx`**

Add `resendCode` to the `useAuth()` destructure (currently line 12):

```js
  const { login, resendCode } = useAuth()
```

Replace the `onSubmit` catch block (currently lines 27-29):

```js
  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ ...form, community_id: Number(form.community_id) })
      navigate('/dashboard/guests')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_UNVERIFIED') {
        const community_id = Number(form.community_id)
        // Fire-and-forget: an unverified-login attempt means no fresh code
        // is likely sitting in their inbox already.
        resendCode({ community_id, email: form.email }).catch(() => {})
        navigate('/verify-email', { state: { email: form.email, community_id } })
        return
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
```

- [ ] **Step 2: Verify live**

If running as a fresh task/session (backend/frontend not already up from Task 8), start both first: `pkill -f "node src/index.js" 2>/dev/null; pkill -f "vite" 2>/dev/null; sleep 1; cd backend && (npm start &) ; sleep 2; cd ../frontend && (VITE_API_URL=http://localhost:3000 npm run dev &) ; sleep 2`.

Using `verify-test-1@example.com` / `Testpass123!` from Task 4 (still unverified — its actual current code isn't known to us, since Task 6's resend test never captured it, so seed a known one):

```bash
cd /home/whereisrico/Projects/hoa/backend
node -e "
require('dotenv').config();
const pool = require('./src/config/db');
const EmailVerification = require('./src/models/EmailVerification');
(async () => {
  const { rows } = await pool.query(\"SELECT id FROM residents WHERE email = 'verify-test-1@example.com'\");
  await EmailVerification.create(rows[0].id, '444444');
  console.log('seeded known code 444444 for verify-test-1@example.com');
  await pool.end();
})();
"
```

```bash
cd /tmp/pw-scratch
cat > test4.mjs << 'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('select')?.options.length > 1, { timeout: 8000 });
await page.selectOption('select', { label: 'Lyford Cay' });
await page.fill('input[type="email"]', 'verify-test-1@example.com');
await page.fill('input[type="password"]', 'Testpass123!');
await page.click('button[type="submit"]');

await page.waitForURL('**/verify-email', { timeout: 8000 });
console.log('UNVERIFIED LOGIN REDIRECTED TO VERIFY-EMAIL: true');

await page.fill('input[maxlength="6"]', '444444');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard/guests', { timeout: 8000 });
console.log('VERIFIED VIA LOGIN-REDIRECT PATH, LANDED ON DASHBOARD: true');

await browser.close();
EOF
node test4.mjs
```

Expected: both lines print `true`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "Redirect unverified logins to the verification screen"
```

---

## Task 10: Real end-to-end email test

**Files:** none (verification only, plus a possible retry of Task 3's send if domain verification was still pending)

- [ ] **Step 1: Confirm the sending domain is now Resend-verified**

```bash
cd backend
node -e "
require('dotenv').config();
const { sendVerificationCode } = require('./src/utils/email');
sendVerificationCode('rico@whereisrico.dev', '999999')
  .then(() => console.log('SENT_OK'))
  .catch((err) => console.log('SEND_FAILED:', err.message));
"
```

If this still says `SEND_FAILED: ... domain is not verified`, stop here and resolve the DNS/Resend verification before continuing — every task up to this point has verified the *code paths* using known-code DB overrides, but the actual product isn't done until real email delivery works.

- [ ] **Step 2: Register with a real, owned email address through the real UI, receive the real code, and complete the loop**

If running as a fresh task/session, start both servers first: `pkill -f "node src/index.js" 2>/dev/null; pkill -f "vite" 2>/dev/null; sleep 1; cd backend && (npm start &) ; sleep 2; cd ../frontend && (VITE_API_URL=http://localhost:3000 npm run dev &) ; sleep 2`.

```bash
cd /tmp/pw-scratch
cat > test5.mjs << 'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('select')?.options.length > 1, { timeout: 8000 });
await page.selectOption('select', { label: 'Lyford Cay' });
await page.fill('input[autocomplete="given-name"]', 'Real');
await page.fill('input[autocomplete="family-name"]', 'Email');
await page.fill('input[type="email"]', 'rico@whereisrico.dev'); // change to whatever inbox you'll actually check
await page.fill('input[type="password"]', 'Testpass123!');
await page.click('button[type="submit"]');
await page.waitForURL('**/verify-email', { timeout: 8000 });
console.log('Registered - check the inbox for the real code, then run the follow-up script with it.');
await browser.close();
EOF
node test5.mjs
```

Manually check the inbox for the code, then:

```bash
cat > test6.mjs << 'EOF'
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('select')?.options.length > 1, { timeout: 8000 });
await page.selectOption('select', { label: 'Lyford Cay' });
await page.fill('input[type="email"]', 'rico@whereisrico.dev');
await page.fill('input[type="password"]', 'Testpass123!');
await page.click('button[type="submit"]');
await page.waitForURL('**/verify-email', { timeout: 8000 }); // still unverified, so login redirects here too
await page.fill('input[maxlength="6"]', process.argv[2]); // pass the real code as an argument
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard/guests', { timeout: 8000 });
console.log('REAL EMAIL VERIFIED SUCCESSFULLY: true');
await browser.close();
EOF
node test6.mjs <the real code from the email>
```

- [ ] **Step 3: Confirm the admin-notification email arrived**

Check the inbox of every `role='admin'` resident in community 1 (currently `admin@testhoa.dev` from earlier local seeding). If that's not a real, checkable inbox, temporarily promote a real, checkable email to admin for this one test:

```bash
PGPASSWORD=dev_password_change_me psql -h localhost -U passage -d hoa_dev -c "
SELECT email FROM residents WHERE community_id = 1 AND role = 'admin';
"
```

Confirm a "New resident awaiting approval" email arrived at each address listed.

No commit — this task is pure verification of Task 3/5's already-committed code, using real infrastructure instead of the DB-override technique used earlier for speed.

---

## Task 11: Prod migration + deploy

**Files:**
- Modify: `.do/app.yaml`

**Interfaces:** none new — this deploys everything from Tasks 1-10 to production.

- [ ] **Step 1: Apply the schema migration to the production database**

Same `doctl apps console` + base64-heredoc workflow used earlier this session for `manual_contacts` — **use the `echo "$B64"` pattern below, not a direct `cat` pipe into the heredoc, which previously caused a hang from a missing trailing newline before the closing delimiter.**

```bash
cat > /tmp/prod-migrate-email-verification.js << 'EOF'
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
async function main() {
  await pool.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;`);
  // Backfill existing residents to true - this feature is about *new*
  // signups, not retroactively demanding unproven residents re-verify.
  await pool.query(`
    -- ONE-TIME ONLY: this backfills residents that predate this feature.
    -- Do NOT re-run this after the initial deploy - it would silently mark
    -- every currently-pending, genuinely-unverified registrant as verified.
    UPDATE residents SET email_verified = true WHERE email_verified = false;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id SERIAL PRIMARY KEY,
      resident_id INTEGER NOT NULL REFERENCES residents(id),
      code_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verifications_resident ON email_verifications(resident_id);`);
  const { rows } = await pool.query(`SELECT to_regclass('public.email_verifications') AS t, (SELECT count(*) FROM residents WHERE email_verified = false) AS unverified_count`);
  console.log('MIGRATION_OK table=', rows[0].t, 'unverified_count_should_be_0=', rows[0].unverified_count);
  await pool.end();
}
main().catch((err) => { console.error('MIGRATION_FAILED', err.message); process.exit(1); });
EOF

base64 -w0 /tmp/prod-migrate-email-verification.js > /tmp/migrate.b64
B64=$(cat /tmp/migrate.b64)
{
  echo "cd /workspace/backend"
  echo "cat > migrate.b64 <<'B64EOF'"
  echo "$B64"
  echo "B64EOF"
  echo "base64 -d migrate.b64 > migrate-email-verification.js"
  echo "node migrate-email-verification.js"
  echo "rm -f migrate.b64 migrate-email-verification.js"
  echo "exit"
} > /tmp/console-commands.txt

script -qec "doctl apps console 124a987b-407c-48e0-a2e3-6d9125a996d5 backend" /dev/null < /tmp/console-commands.txt
```

Expected in the output: `MIGRATION_OK table= email_verifications unverified_count_should_be_0= 0`.

- [ ] **Step 2: Set the new secrets on the live DO app**

```bash
doctl apps spec get 124a987b-407c-48e0-a2e3-6d9125a996d5 > /tmp/live-spec.yaml
```

Edit `/tmp/live-spec.yaml` (not the repo's `.do/app.yaml`) — add two entries to the `backend` service's `envs:` list, using the real values from `backend/.env`:

```yaml
      - key: RESEND_API_KEY
        type: SECRET
        value: <the real value from backend/.env's RESEND_API_KEY>
      - key: EMAIL_FROM
        value: notifications@palisade.whereisrico.dev
```

```bash
doctl apps update 124a987b-407c-48e0-a2e3-6d9125a996d5 --spec /tmp/live-spec.yaml
rm /tmp/live-spec.yaml
```

- [ ] **Step 3: Update the repo's `.do/app.yaml` to document the new env vars (placeholder values only — never the real secret)**

Add to the `backend` service's `envs:` list, matching the existing `JWT_SECRET` entry's style:

```yaml
      - key: RESEND_API_KEY
        type: SECRET
        value: REPLACE_ME_IN_DASHBOARD
      - key: EMAIL_FROM
        value: notifications@palisade.whereisrico.dev
```

- [ ] **Step 4: Commit and push**

```bash
git add .do/app.yaml
git commit -m "Document RESEND_API_KEY/EMAIL_FROM in the app spec (prod value set directly on DO)"
git push origin main
```

`deploy_on_push: true` means this triggers an automatic deployment.

- [ ] **Step 5: Watch the deployment and confirm it goes ACTIVE**

```bash
doctl apps list-deployments 124a987b-407c-48e0-a2e3-6d9125a996d5 --format ID,Phase,Cause --no-header | head -1
```

Poll `doctl apps get-deployment 124a987b-407c-48e0-a2e3-6d9125a996d5 <id> --format Phase` until `ACTIVE`.

- [ ] **Step 6: Smoke-test registration on prod**

```bash
curl -s -X POST https://palisade.whereisrico.dev/api/auth/register -H "Content-Type: application/json" -d '{
  "community_id": 1, "email": "<a real email you can check>", "password": "Testpass123!",
  "first_name": "Prod", "last_name": "Smoketest"
}'
```

Expected: `201 {"email":"...","community_id":1}`, and a real verification email arrives. Then verify via the actual UI at `https://palisade.whereisrico.dev/register` → check code → confirm landing on the pending-approval dashboard, and confirm the admin-notification email arrives at every admin resident's inbox for that community.

No further commit — this task is deploy + verification of everything already committed in Tasks 1-10.
