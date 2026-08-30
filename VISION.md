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

## Brand / UI Redesign Exploration (2026-08-30)
As of this date, the product is renamed **Palisade** (company **Argus**),
replacing the prior Passage/Threshold naming used since initial build.
Paired with an existing "Argus" logo mark already on hand (ink navy
`#10202B` mark, amber `#E08A1E` accent dot — see `argus-a-lens.pdf` /
`argus-word-integrated.pdf` at repo root). This is a naming/brand decision
only — the live code and infrastructure (domain, DO app name, DB, GitHub
repo) still use the old Passage naming and have not been migrated; see the
naming note in CLAUDE.md.

Six visual directions were compared on the resident Guests screen (Bold &
Vibrant, Premium & Dark, Playful & Warm, Brand-True, Playful × Brand, and
Playful × Brand — Light). "Playful × Brand — Light" (Argus navy/amber colors
through Playful & Warm's rounded shapes, on a cream ground) was taken
furthest, with full screens mocked for all four actor types — including a
searchable resident directory with live search + status filter chips
(Gate/Admin), a manual billing-status tag (Trial/Paying/Overdue) on the
platform admin's Communities view, and a new "System Health" screen (recent
errors, per-community last-active) for the platform admin dashboard —
deliberately favored over a revenue dashboard, since there's no Stripe
integration yet to back real billing analytics.

This work lives entirely in a Claude Artifact
(https://claude.ai/code/artifact/4a757c0a-7c37-45ed-bf14-c8a3114931fe) —
**no code in `frontend/` has been changed.** Next step, if this direction is
approved, is porting the chosen style into the real component library.
