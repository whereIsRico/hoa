# Password Reset Flow — Design Spec

*Brainstormed 2026-09-04. Approved by Rico section-by-section during the conversation that produced this doc. Implements Linear `ARG-6`.*

## Why

No password reset flow exists anywhere in this codebase (frontend or backend). Per `CLAUDE.md`'s prod-data notes, this has already caused two real incidents: both the platform admin (`rico@threshold.dev`) and the one onboarded community's admin (`jeremiah@test.com`) have needed a manual reset via a hand-run bcrypt-hash-and-`UPDATE` script over `doctl apps console`. That workaround doesn't scale past a single founder being reachable. `ARG-7` (shipped 2026-09-04) built the Resend email infrastructure and a `token_version` revocation primitive specifically so this ticket would have less to build from scratch.

## Scope

Covers **all three actor types that log in with a password**: residents, gate staff, platform admins. Not gate staff *or* residents only — all three, matching how login/rate-limiting/JWT revocation were all built symmetrically across all three actor types in `ARG-7`.

## Data model

One new table, **shared and polymorphic** (matching `audit_logs`' existing `actor_type`/`actor_id` pattern, rather than three near-identical per-actor tables):

```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  actor_type VARCHAR(50) NOT NULL,   -- 'resident' | 'gate_staff' | 'platform_admin'
  actor_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL,  -- SHA-256 hex digest of the raw token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
```

**Token hashing: SHA-256, not bcrypt.** This is a deliberate correction from `EmailVerification`'s pattern, not a copy of it. `EmailVerification.matchesCode` works because that flow already knows the resident's identity (looked up via `email` + `community_id`) and only needs to verify a code *against that specific already-fetched row*. A password-reset link gives the backend nothing but the raw token — the row has to be found *by* the token itself, which requires a deterministic, indexable hash. Bcrypt is salted and non-deterministic by design (correct for low-entropy secrets like passwords/PINs, where slow hashing resists brute force) — it cannot support `WHERE token_hash = $1`. SHA-256 can, and is standard practice for reset tokens specifically, because the token itself is already 256 bits of random entropy (`crypto.randomBytes(32).toString('hex')`) — brute-forcing a fast hash of that is still computationally infeasible, so bcrypt's slowness buys nothing here.

**TTL: 1 hour.** A considered default (industry-standard range), not derived from a specific constraint of this app — confirmed with Rico during design.

**Single-use, and superseding:** the token row is deleted on successful use. Requesting a new reset link deletes any existing unexpired token(s) for that `actor_type`/`actor_id` first, so only the most recently requested link is ever valid — otherwise multiple old links would all stay live simultaneously, which isn't what a user asking for "a new link" expects.

## Backend API

Six new endpoints, two per actor type, in the existing per-actor route files (mirroring how login is already split across `auth.js`/`staffAuth.js`/`platformAuth.js` rather than one shared generic endpoint):

| Endpoint | File | Request | Behavior |
|---|---|---|---|
| `POST /api/auth/forgot-password` | `auth.js` | `{ community_id, email }` | |
| `POST /api/auth/staff-forgot-password` | `staffAuth.js` | `{ community_id, email }` | |
| `POST /api/auth/platform-forgot-password` | `platformAuth.js` | `{ email }` (no community scoping) | |
| `POST /api/auth/reset-password` | `auth.js` | `{ token, new_password }` | |
| `POST /api/auth/staff-reset-password` | `staffAuth.js` | `{ token, new_password }` | |
| `POST /api/auth/platform-reset-password` | `platformAuth.js` | `{ token, new_password }` | |

**`forgot-password` (all three):**
1. Look up the actor. Whether found or not, **always return the same generic 200** ("if an account exists, a reset link was sent") — prevents email enumeration, consistent with how login/staff-login/platform-login already give inactive and nonexistent accounts an identical error.
2. If found: delete any existing unexpired token(s) for this actor, generate a new raw token + SHA-256 hash, insert the row, email the link (`sendPasswordResetEmail`) pointing at that actor's frontend reset page with `?token=...`.
3. Rate-limited like `registerLimiter` (5/15min/IP).

**`reset-password` (all three):**
1. Hash the incoming `token` (SHA-256), look it up.
2. Not found or expired → identical generic error ("Invalid or expired reset link") for both cases — don't let the message leak which case it was.
3. Validate `new_password` (same rule as registration: ≥ 8 chars).
4. Found and valid: update the actor's `password_hash`, call `incrementTokenVersion(actor_id)` for that actor's model (this is exactly what that primitive — built and unused since `ARG-7` — was for: instantly invalidates every other active session for this account), delete the used token row.
5. Rate-limited similarly to the forgot-password endpoints (defense-in-depth; the token's own entropy already makes brute force infeasible).

**Audit logging:** resident and gate-staff resets get an `audit_logs` entry (`action: 'password.reset'`) — both have a real `community_id`. Platform-admin resets do **not** get one: `audit_logs.community_id` is `NOT NULL`, and a platform admin's own account action has no community to attach to — this mirrors existing behavior (platform-admin login itself isn't audit-logged today either), not a new gap introduced by this feature.

## Frontend

Six new page components, one pair per actor type — matching the existing convention where `LoginPage`/`StaffLoginPage`/`PlatformLoginPage` are already fully separate files (not one generic component parameterized by actor type):

- Resident: `/forgot-password` → `/reset-password?token=...`
- Gate staff: `/staff/forgot-password` → `/staff/reset-password?token=...`
- Platform admin: `/platform/forgot-password` → `/platform/reset-password?token=...`

Each pair is small (a `Field` + `Button` + `Banner` for errors, reusing existing UI components) and wrapped in `AuthLayout` the same way the login pages already are. Each existing login page gets a "Forgot your password?" link added, pointing at its actor's forgot-password route. Routes are added to `App.jsx` inside the existing `PublicOnlyRoute`/`StaffPublicOnlyRoute`/`PlatformPublicOnlyRoute` groupings, next to `/login` etc.

`frontend/src/lib/api.js`: new `forgotPassword`/`resetPassword` functions added to the existing `authApi`/`staffApi`/`platformApi` groupings.

## Email

One new function, `sendPasswordResetEmail(to, resetUrl)`, in `backend/src/utils/email.js` — styled like the existing `sendVerificationCode` (plain text, matching this codebase's convention, not HTML). Subject: "Reset your Palisade password." Body includes the link, notes it expires in 1 hour, and includes the standard "if you didn't request this, ignore it" line.

## Testing plan (TDD)

Following the same discipline established in `ARG-7` (Jest + supertest, model-layer mocking via `jest.mock()`, no live DB anywhere in this suite):

- Rate limiting on all three `forgot-password` endpoints (same pattern as `auth.loginRateLimit.test.js`).
- `forgot-password` returns an identical response whether the account exists or not (mock the actor model to return `null` vs. a real row).
- `reset-password`: valid token → password updated, `token_version` bumped, token deleted; a second use of the same token then fails (proves single-use).
- `reset-password`: expired token, and separately a nonexistent token → both get the identical generic rejection.
- A second `forgot-password` request invalidates the first token.
- Password-length validation on reset.

Given the mechanical repetition across three actor types, tests are batched per-behavior across actor types (one test file per behavior, covering all three routes) rather than three fully separate RED/GREEN cycles for identical logic repeated three times — same approach used for the three login-rate-limit tests in `ARG-7`.

## Deployment note

This introduces a new table (`password_reset_tokens`), not just new columns on existing tables — same "migration before code deploy" ordering requirement established during `ARG-7` applies here. No existing code references this table, so applying it early is safe; deploying the code before the table exists would break only the six new endpoints (not every authenticated route, unlike `ARG-7`'s `token_version` columns), but the ordering should still be migration-first as a matter of consistent practice.

## Explicitly out of scope

- SMS-based reset (Resend/email only, matching `ARG-6`'s original title)
- Changing password *while logged in* (a different, smaller feature — this is specifically the "I forgot my password" recovery flow)
- Any change to `EmailVerification`'s existing bcrypt-based code scheme — that flow is unaffected by this design
