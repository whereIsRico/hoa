# Email verification + admin notification — design spec

Date: 2026-08-30
Status: approved by Rico, ready for implementation planning

## Why

Traced from `LAUNCH_READINESS.md` (2026-08-30): registration currently
creates a working, logged-in account from any string that merely looks
like an email, with no proof of ownership, and notifies nobody. This
closes both gaps, and the transactional-email capability it introduces
is also the prerequisite for a real password-reset flow later (out of
scope here, but the sending infrastructure this spec builds is what
that will reuse).

## Decisions made during brainstorming (do not re-litigate)

- Verification is a **6-digit numeric code**, not a magic link.
- Verification is a **hard gate**: an unverified resident gets no
  dashboard access at all, not even the pending-approval view. Only
  after verifying do they land where registration lands today (pending
  HOA approval, unchanged).
- Admin notification, once a resident verifies, goes to **every
  `role='admin'` resident in that community** (not the community's
  office email) — so whoever happens to be managing things sees it.
- Email provider: **Resend**, sending from a subdomain of
  `whereisrico.dev` (a domain already controlled and already used for
  `palisade.whereisrico.dev`) rather than `argus.dev`, which nobody
  owns the mail for.

## Out of scope (explicitly deferred, not forgotten)

- Rate limiting on the *existing* login endpoints
  (`/api/auth/login`, `/api/auth/staff-login`, `/api/auth/platform-login`)
  — a real, separate `LAUNCH_READINESS.md` gap, but not required to ship
  this feature safely (only the two *new* endpoints this spec adds get
  rate-limited).
- Password reset — reuses this same Resend setup later, but is its own
  feature with its own flow.
- Re-verifying an email if a resident later changes it via profile
  edit — `unit_number`/`email` are already read-only on the profile
  edit endpoint (`PROFILE_EDITABLE_FIELDS`), so this isn't reachable
  today.
- Offboarding/deleting an *approved* resident (as opposed to rejecting
  a pending one, already shipped separately) — bigger feature, guest
  history to account for.

## Data model

New table:

```sql
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id),
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_verifications_resident ON email_verifications(resident_id);
```

A separate table rather than columns on `residents` — keeps "resend"
trivial (insert a new row, no in-place overwrite juggling) and matches
this codebase's existing convention of purpose-built tables
(`manual_contacts` is the precedent) over overloading an existing one.
Old/expired rows are not actively pruned in this pass — acceptable at
current scale, worth a follow-up if the table ever grows large.

`residents` gets one new column:

```sql
ALTER TABLE residents ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
```

Existing seeded/test/prod residents predate this column and will read
as `false` under the `NOT NULL DEFAULT false` — see "Migration
sequencing" below for why that's handled explicitly, not silently.

## Backend endpoints

All in `backend/src/routes/auth.js` unless noted.

### `POST /api/auth/register` (modified)

Behavior unchanged up through creating the resident row, except the row
now also gets `email_verified = false` (via the new column's default —
no code change needed there). After creation:

1. Generate a 6-digit code (`String(crypto.randomInt(100000, 1000000))`
   — reject leading-zero collision by using this range, not
   `Math.random()`).
2. Hash it with the existing `utils/password.js` bcrypt helper (reused
   as-is, not a new hashing utility).
3. Insert an `email_verifications` row, `expires_at = now() + 15
   minutes`.
4. Send the verification-code email via Resend (see "Email sending"
   below). If sending fails, roll back the whole transaction and return
   a 502 — a resident should never end up in a state where an account
   exists but no code was ever deliverable.
5. Return `201 { email, community_id }` — **no token**. This is the
   behavioral break from today: registration no longer logs you in.

### `POST /api/auth/verify-email` (new)

Body: `{ community_id, email, code }`.

1. Look up the resident by `email` + `community_id` (mirrors
   `findByEmailAndCommunity`). 404 if not found — do not leak whether
   an email exists across communities.
2. If `resident.email_verified` is already `true`, 409 (idempotent
   protection against a stale/reused verify screen).
3. Look up the most recent `email_verifications` row for that resident.
   `400` if none exists or it's expired ("Code expired, request a new
   one") — `404` stays reserved for "no such resident," this is a
   different condition (resident exists, just has no live code).
4. Compare the submitted code against `code_hash` via
   `password.compare`. Wrong code → 401, and this attempt counts
   against the rate limit (see "Rate limiting").
5. On match: `UPDATE residents SET email_verified = true`, delete (or
   just leave — cheap either way, but deleting keeps the table small)
   the used `email_verifications` row, and in the same transaction:
   - Send the "new resident pending approval" email to every
     `role='admin'` resident in that community (query same as
     `countAdminsInCommunity` but returning emails, not a count).
   - `AuditLog.log(... action: 'resident.email_verified' ...)`.
6. Issue the JWT exactly as `register`/`login` do today. Response
   shape: `{ resident, token }` — identical to what `register`
   returned before this change, so `AuthContext` and every downstream
   consumer of "a session" needs zero changes beyond where the token
   now gets set (see frontend section).

Admin-notification email failure does **not** roll back verification —
the resident owns their email, that's the important part; a
best-effort admin email that fails shouldn't trap them in limbo. Log
the failure server-side, don't surface it to the resident.

### `POST /api/auth/resend-code` (new)

Body: `{ community_id, email }`.

1. Look up the resident. 404 if not found (community-scoped, same
   leak-avoidance as above).
2. 409 if already verified.
3. Same generate/hash/insert/send sequence as step 1-4 of register.
4. Rate-limited (see below) — this is the endpoint most exposed to
   "spam a stranger's inbox" abuse, since it needs no proof of anything
   to call repeatedly.

### `POST /api/auth/login` (modified)

After password verification succeeds (unchanged), add one check before
issuing the token: if `!resident.email_verified`, return `403 { error:
'Email not verified', code: 'EMAIL_UNVERIFIED' }` instead of a token.
This closes the obvious bypass — without it, a resident who never
verifies could just log in directly with the password they already
set.

## Rate limiting

New dependency: `express-rate-limit`. Two limiters, scoped only to the
two new routes (existing login endpoints are explicitly out of scope
here, see above):

- `verify-email`: 10 attempts / 15 minutes, keyed by IP (the
  `express-rate-limit` default — not per-account, keeping this a
  simple first pass rather than building custom keying infrastructure
  for a low-severity secondary control; the code's own 15-minute
  expiry is the primary defense, this is defense-in-depth against a
  single attacker hammering one code).
- `resend-code`: 1 request / 60 seconds, keyed by IP.

## Email sending

New dependency: `resend` (official SDK). New module
`backend/src/utils/email.js` exporting `sendVerificationCode(to, code)`
and `sendAdminNotification(adminEmails, { residentName, communityName,
communityId })` — both thin wrappers around the Resend client, keeping
the actual API surface small and swappable if the provider ever
changes.

New env vars (`backend/.env` locally, DO app secret in prod, same
pattern as `JWT_SECRET`):

- `RESEND_API_KEY`
- `EMAIL_FROM` — e.g. `notifications@palisade.whereisrico.dev`

Templates are plain and short:

- Verification: "Your Palisade verification code is **123456**. It
  expires in 15 minutes."
- Admin notification: "**\<name\>** registered as a resident of
  **\<community\>** and is waiting for your approval." with a link to
  `/dashboard/admin/residents`.

Domain setup (manual, one-time, done together during implementation):
create the Resend account, verify `palisade.whereisrico.dev` (or a
dedicated subdomain of it) by adding the SPF/DKIM records Resend
provides to the existing Route53 zone, generate the API key.

## Frontend

New page `frontend/src/pages/VerifyEmailPage.jsx`, route `/verify-email`
(public, alongside `/login`/`/register`). Reached two ways, both
passing `{ community_id, email }` via React Router navigation state:

1. From `RegisterPage` on successful submit (a code was just sent).
2. From `LoginPage` when it catches `code: 'EMAIL_UNVERIFIED'` — this
   path also fires an automatic `resendCode` call on mount, since an
   unverified-login attempt means no fresh code is likely sitting in
   their inbox already.

UI: 6-digit numeric input, "Verify" button, "Resend code" link that
disables itself with a visible cooldown countdown (client-side timer,
independent of but matched to the backend's 60-second limiter — a
premature resend attempt still just gets a 429 from the backend, the
client-side cooldown is purely to avoid a confusing extra round trip).

`AuthContext.jsx` changes:

- `register()` no longer sets `token`/`resident`/localStorage itself —
  it just calls the API. `RegisterPage` then navigates to
  `/verify-email` with the returned `email`/`community_id`.
- New `verifyEmail(community_id, email, code)` method — this is what
  now sets `token`/`resident`/localStorage on success, exactly
  mirroring what `register()` used to do. `VerifyEmailPage` calls this
  and, on success, navigates to `/dashboard/guests` same as today.
- New `resendCode(community_id, email)` passthrough for the "Resend
  code" button and the auto-fire-on-unverified-login case.
- `login()` gains a catch branch for `err.code === 'EMAIL_UNVERIFIED'`
  that navigates to `/verify-email` instead of setting the error
  banner. This requires a small addition to `ApiError` itself
  (`frontend/src/lib/api.js`): today it only captures
  `status`/`message`/`details` from the response body, not an
  arbitrary `code` field — add `this.code = body?.code || null` to the
  constructor. This is the one small ripple into existing shared code,
  called out explicitly rather than left implicit.

`App.jsx`: add the `/verify-email` route inside whatever wraps the
other public auth routes.

## Migration sequencing (prod)

Same manual `doctl apps console` workflow used for `manual_contacts`
earlier today. Order matters here more than it did for that migration:
the `ALTER TABLE residents ADD COLUMN email_verified ... DEFAULT
false` step must land on prod *before* the new backend code deploys,
same reasoning as before — the new login-gate check reads a column
that doesn't exist yet otherwise. Existing prod residents (the
`@argus.dev`/`@test.com` test accounts, and anyone real who's
registered) will all read `email_verified = false` after this
migration — **they will be locked out of login until manually
backfilled** (`UPDATE residents SET email_verified = true` for
existing rows is part of the same migration script, not a follow-up
step) or they'll hit the same "verify by email" flow a brand-new
resident would, despite having used the app for months. Backfilling
existing rows to `true` as part of the migration is the right call:
this feature is about *new* signups, not about retroactively
demanding unproven residents re-verify.

## Testing plan

No automated test suite exists in this repo (a separate
`LAUNCH_READINESS.md` gap) — this ships with the same manual,
against-a-real-backend verification discipline used for every other
feature built this session:

- Register with a real, owned email address; confirm the code arrives
  and the dashboard is genuinely unreachable before verifying (try
  navigating directly to `/dashboard/guests` with the token that
  *isn't* issued yet — there shouldn't be one to try).
- Enter the code; confirm landing in the pending-approval dashboard,
  unchanged from today's post-approval-wait UI.
- Confirm every admin resident in the community received the
  notification email.
- Wrong code → 401, and confirm the rate limit actually trips after
  enough wrong attempts.
- Expired code (mock a short expiry or wait) → clear error, "Resend"
  works.
- Attempt `/api/auth/login` directly against an unverified account →
  `EMAIL_UNVERIFIED`, not a token.
- Resend spam → 429 after the limit.
- Cross-community isolation: registering the same email in two
  different communities doesn't collide (already true today, just
  confirm the verification layer doesn't break it).
