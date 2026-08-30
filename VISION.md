# Palisade - HOA Guest Management Platform

**Company:** Argus
**Product:** Palisade

## Problem
Nassau HOAs manage guests with pen/paper and Excel. It's insecure, inefficient, and outdated.

## Solution
Cloud-based guest pre-registration and check-in system for residents, gate staff, and HOA admins.

## Core Features (MVP)
1. Resident dashboard - pre-register guests
2. Gate staff portal - real-time check-in
3. HOA admin dashboard - reports & compliance

## Business Model
$200-500/month per HOA
Target: 10-15 customers = $3,600-4,500/month

## Tech Stack
- Frontend: React + Tailwind
- Backend: Node.js + Express + PostgreSQL
- Infrastructure: Docker + AWS/DigitalOcean
- SMS/Email: Twilio/Sendgrid

## 90-Day Timeline
- Month 1: MVP build
- Month 2: Polish + first beta customer
- Month 3: Sales + 3-5 paying customers

## Next Steps
1. Validate with 1-2 HOA managers
2. Build detailed requirements
3. Start architecture/database design

## Brand / UI Redesign — LIVE (2026-08-30)
As of this date, the product is renamed **Palisade** (company **Argus**),
replacing the prior Passage/Threshold naming used since initial build.
Paired with an existing "Argus" logo mark already on hand (ink navy
`#10202B` mark, amber `#E08A1E` accent dot — see `brand/argus-a-lens.pdf` /
`brand/argus-word-integrated.pdf`).

The direction explored in a Claude Artifact
(https://claude.ai/code/artifact/4a757c0a-7c37-45ed-bf14-c8a3114931fe) —
"Playful × Brand — Light" (Argus navy/amber colors through Playful & Warm's
rounded shapes, on a cream ground) — has been **implemented in the real
codebase and deployed to production**, not just mocked:
- New design tokens (cream/ink-navy/amber palette, Fredoka + Nunito Sans
  fonts, 22px/14px radii, blob avatars) across all four portals. Dark mode
  is disabled for now (light-only; no dark tokens exist for this palette
  yet — see "Next Up" below).
- A searchable resident directory (live search + On Palisade/Pending
  filter chips) for Gate Staff and Admin, with click-through to a call
  button on both residents and the HOA office contact.
- A platform-admin Directory (filterable by Starter/Professional/
  Enterprise), a real billing-status tag (Paying/Trial/Overdue, backed by
  the previously-unused `subscriptions` table), and a System Health screen
  showing per-community "last activity" staleness derived from
  `audit_logs`.
- The full **domain cutover** is also done: production now runs solely at
  `palisade.whereisrico.dev` (old `passage.whereisrico.dev` retired, DNS +
  DO app spec both updated). Code-level "Passage"/"Threshold" strings were
  also renamed; live infra identifiers that weren't (GitHub repo name,
  database name `passage-db`) are deliberately deferred — see
  `RENAME_MIGRATION_PLAN.md`.

Full implementation plan, phase-by-phase file list, and the product
decisions made along the way: `REDESIGN_IMPLEMENTATION_PLAN.md`.

## Next Up
Roughly in priority order:
1. **Visually verify the live redesign in a real browser** — this session's
   work was checked via build/lint and API calls only, never actually
   looked at in a browser. Test accounts exist for all 4 roles at Lyford
   Cay (see `CLAUDE.md`) specifically for this.
2. **Production-tier database** (backups + HA) before onboarding a real
   paying HOA — the current dev-tier DB has zero backups, which is a real
   risk given how much of this session's own work depended on hand-run
   console scripts against it.
3. **Real ownership + mail routing for `argus.dev`** — the platform admin
   login is `rico@argus.dev`, but nobody owns/controls that domain yet, so
   there's no actual mailbox behind it (fine for now since the app sends
   no emails, but blocks any future password-reset flow).
4. **Dark mode tokens** for Playful × Brand — currently light-only by
   deliberate choice, not because dark mode was ruled out.
5. **GitHub repo rename + database rename** — both still deferred per
   `RENAME_MIGRATION_PLAN.md`'s own recommendation; revisit together, in
   one sitting, once there's an actual external reason (e.g. going public).
6. **Stripe integration** so the billing-status tag reflects real payments
   instead of an admin manually toggling Paying/Trial/Overdue.
7. **Schema migration tooling** — every schema change this session (and
   before) required a hand-run script over `doctl apps console`; worth a
   real migration tool before the schema grows further.
8. **System Health error-log telemetry** — deliberately deferred; DO's own
   stdout/stderr capture covers this in the meantime.
9. **Resident self-registration + admin-approval flow on prod** — still
   only tested locally, not end-to-end on the live app (older outstanding
   item, still open).
