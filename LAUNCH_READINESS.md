# Launch Readiness — Palisade (2026-08-30)

Honest end-to-end assessment of whether the product is ready for real
paying HOA customers, based on reading the actual auth flow, middleware
stack, billing logic, and test coverage (not just recalling prior sessions).

## Overall verdict

**Not ready for real paying customers yet — but genuinely close for a
supervised pilot with one trusted HOA.** The core product (guest invite →
approve/deny → check-in → check-out, with a real audit trail, tenant
isolation, and configurable policies) is solid and has been manually
verified end-to-end repeatedly. The gaps are almost entirely in
production-hardening and account-recovery, not core logic.

## Must-fix before any real customer touches it

1. **No password reset flow — anywhere.** Frontend or backend, there's
   nothing. Today, "I forgot my password" means Rico personally running a
   script against the production console. That's already happened once.
   It will happen constantly with real users, at times he's not available.
2. **No email/SMS sending capability at all** (no Sendgrid/Resend/Twilio —
   checked `package.json`, nothing's there). This is really the same
   problem as #1: you can't build password reset without it, and it's
   also blocking anything else that should notify someone (a guest was
   denied, an account was approved, etc.).
3. **Login endpoints have zero rate limiting.** `/api/auth/login`,
   `/api/auth/staff-login`, `/api/auth/platform-login` are all wide open
   to brute-force — no lockout, no throttling, nothing.
4. **Production DB is still dev-tier — no backups, no HA.** One bad
   migration or a DO incident and every resident, guest, and audit record
   is gone with no way back. Flagged since the very first deploy, never
   addressed.
5. **No terms of service / privacy policy anywhere.** The app stores
   residents' names, phone numbers, unit numbers, and a visit log of
   everyone who comes to see them, with zero stated data-handling policy.
   That's a real liability, not paperwork.

## Should fix soon (survivable for a short pilot, not for real revenue)

6. **Zero automated tests.** Every feature has been verified by hand,
   impressively thoroughly — but there's no regression safety net. The
   next change *will* eventually break something silently.
7. **Billing status is decorative.** `subscription_status`
   (Paying/Trial/Overdue) doesn't actually gate anything in the code — an
   overdue HOA keeps full access forever. Fine pre-revenue; becomes a real
   gap the moment someone gets invoiced for real.
8. **`community.is_active` doesn't block access either.** There's no real
   way to suspend/offboard a customer today, even manually.
9. **CORS is wide open + 7-day JWTs in localStorage with no revocation.**
   Each is individually defensible, but together: one XSS bug anywhere
   fully compromises a session for a week with no kill switch.
10. **No error/uptime monitoring beyond DO's raw stdout capture.** If
    something breaks for one HOA at 2am, the first signal is a phone call.

## Design/polish (low urgency)

11. No real 404 page — mistyped links silently bounce to login.
12. Guest self-checkout isn't enforced, but this one's honest — the
    toggle is visibly disabled in the UI rather than pretending to work.
13. Bootstrapping a brand-new community's first admin, or adding a second
    platform admin, both still require a manual DB step. Fine while it's
    a single-founder company.
14. Passage/Threshold naming still lingers in the GitHub repo name and DB
    name (`passage-db`) — cosmetic, already deliberately deferred (see
    `RENAME_MIGRATION_PLAN.md`).

## What's actually working well

The guest lifecycle, multi-actor auth (resident/admin/gate-staff/platform-
admin with verified cross-type isolation), policy enforcement, and the
redesign (visual identity, mobile responsiveness, dark mode) are
genuinely good — not "AI slop," which matters a lot against a competitive
bar of pen-and-paper and Excel.

## Recommendation

Items 1–5 are the real blockers. Of those, **password reset + transactional
email (1+2)** is the single highest-leverage thing to build next — it's
the one gap that will actively cause pain even in a friendly pilot.
