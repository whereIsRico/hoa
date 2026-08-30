# Implementation Plan: Palisade Visual Redesign + Directory/Billing/Health Features

*Researched 2026-08-30. Read-only research only — nothing below has been executed.*

## Codebase context that shapes this plan

- **Design tokens are centralized and cascade automatically.** `frontend/src/index.css` defines everything (`--color-neutral-*`, `--color-accent-*`, `--color-coral-*`, `--color-status-*`, `--radius-field`, `--radius-card`) as Tailwind v4 `@theme` custom properties. Components consume them via classes or `var(--radius-card)` — never hardcoded hex. Most of the re-theme is genuinely a one-file edit; only components with values that don't map 1:1 onto the new spec need hand-editing.
- **No pagination or server-side search exists anywhere in the app.** Every list fetches the full community-scoped array and renders it. Directory search/filtering should follow the same pattern: client-side substring filter, not a new backend search endpoint.
- **Gate Staff currently has almost no API surface** (`backend/src/routes/staff.js` is just `GET /me`) and **no way to see residents at all**. Admin already can (`GET /api/admin/residents`); Platform Admin already can see everything needed for its directory (`GET /api/platform/communities`, which already returns `subscription_tier`, `email`, `phone`).
- **`subscriptions` table exists, has the right shape (`status` column, default `'active'`), and is completely unpopulated.** No schema change needed for the billing tag — just population + a read path + an admin action to change it.
- **`audit_logs` already has everything needed for a "last activity per community" signal** (`community_id`, `created_at`) — zero schema change for that half of System Health.
- **Dark mode is pervasive and real** — every component/page has `dark:` variants. The new design spec is a **light-only** palette with no dark equivalents provided. Decision point, flagged below.
- **"Passage" branding is still hardcoded in 4 UI files** plus the backend root route string, despite the product being renamed to Palisade per CLAUDE.md. Trivial to swap while these exact files are already being touched for Phase 1 — optional bundle-in, not a requirement.

---

## Phase 1 — Pure re-theme (tokens, fonts, radii, avatar shape, semantic colors)

**Goal:** ship the "Playful × Brand — Light" visual system with zero backend/schema changes.

### Files to change
- `frontend/src/index.css` — rebuild the neutral scale anchored on `#FFF8EC`/`#FFFFFF`/`#F1E4CE`/`#16242E`/`#7C8B93`; new `--color-accent-*` scale anchored on `#E08A1E` plus **new** `--color-accent-contrast: #10202B`; **new `--color-accent2-*` scale** anchored on `#10202B` plus `--color-accent2-contrast: #F4F1EA` (a genuinely new second-accent axis — today's system only has `accent` + `coral`); remap `--color-status-*` for contrast against the new cream background; `--radius-field: 14px`, `--radius-card: 22px`; swap Geist+Sora fonts for Fredoka+Nunito Sans (**keep Geist Mono** for numeric/tabular display — nothing in the new spec replaces it and true monospace still benefits date/count alignment).
- `frontend/package.json` — add `@fontsource-variable/fredoka` + `@fontsource-variable/nunito-sans`; remove `geist` + `sora` once unused (keep `geist-mono`).
- `frontend/src/components/ui/Avatar.jsx` — blob shape via inline style (`borderRadius: '30% 70% 65% 35% / 45% 35% 65% 55%'`, more reliable than fighting Tailwind's arbitrary-value escaping); palette should skew toward accent-2/ink-navy per spec.
- `frontend/src/components/ui/Button.jsx` — primary variant hardcodes `text-white`; with accent now amber, needs `text-accent-contrast` instead — a real contrast fix, not just a token swap.
- `frontend/src/pages/DashboardLayout.jsx` + `frontend/src/pages/admin/AdminLayout.jsx` — active nav state should reassign from primary accent to **accent-2** (ink navy) per spec — a deliberate token reassignment, not automatic.
- `frontend/src/components/ThemeToggle.jsx` — depends on Founder Decision #1.
- **No changes expected** (confirms the token system works): `Card.jsx`, `Banner.jsx`, `Field.jsx`, `Skeleton.jsx`, `Switch.jsx`, `Badge.jsx`, `StatusBadge.jsx`, `EmptyState.jsx`, and all pages consuming tokens generically — worth a spot-check after the palette lands.
- **Optional bundle-in:** `"Passage"` → `"Palisade"` string swap in `AuthLayout.jsx`, `DashboardLayout.jsx`, `StaffDashboardLayout.jsx`, `PlatformDashboardLayout.jsx`, `backend/src/index.js`'s root route message.

### Founder decisions blocking Phase 1
1. **Dark mode has no spec** — the brief gives only light tokens. Recommendation: ship light-only for now (no-op or hide `ThemeToggle`), treat proper dark tokens as a follow-up. Alternative: block Phase 1 until dark tokens exist.
2. Confirm the "Passage"→"Palisade" string swap is in scope for this pass or deferred to the full rename effort (see `RENAME_MIGRATION_PLAN.md`).

**Effort/Risk:** Low-medium, low risk, fully reversible via CSS. Worth a contrast-ratio check on amber-on-cream / navy-on-cream before shipping.

---

## Phase 2 — Directory feature (Gate Staff + Admin)

### Product decision: "On Palisade" semantics
The mockup invented a "Not on Palisade" phone-only contact with no backing table. **Recommendation: drop it for v1.** Every `residents` row already represents someone who self-registered, so:
- **"On Palisade"** = `is_approved = true`
- **"Pending"** = `is_approved = false` (already exists, already shown elsewhere)
- **"Not on Palisade"** has no natural home today — real implementation needs a new `known_contacts`-style table plus an unresolved product question (who maintains that roster?). Shipping 3 honest chips beats inventing a data model for a roster no one's agreed to own.

**Founder decision needed:** confirm dropping it for v1, or scope the real feature if the roster-ownership question already has an answer.

### Architecture: enhance existing page vs. new page
**Admin:** add search + filter chips + click-to-detail directly into the existing `AdminResidentsPage.jsx` rather than forking a duplicate page. **Gate Staff:** genuinely new — `StaffDashboardLayout.jsx` currently shows only guests, needs a new page + nav tab.

### Backend (reuses existing model methods, no schema change)
- `backend/src/routes/staff.js` — add `GET /api/staff/residents` (→ `Resident.listForCommunity`) and `GET /api/staff/community` (→ `Community.findById`).
- `backend/src/routes/admin.js` — add `GET /api/admin/community` (→ `Community.findById`).

### Frontend
- `frontend/src/lib/api.js` — add `staffApi.listResidents`, `staffApi.getCommunity`, `adminApi.getCommunity`.
- `frontend/src/lib/useDirectorySearch.js` **(new)** — shared hook: filters a list by search string + active chip; shared between Staff's new directory and Admin's enhanced one.
- `frontend/src/pages/admin/AdminResidentsPage.jsx` — add search input, filter chips, pinned office-contact row, click-through to detail modal (Phase 5).
- `frontend/src/pages/StaffDirectoryPage.jsx` **(new)** — read-only mirror of the above (no approve/promote actions).
- `frontend/src/pages/StaffDashboardLayout.jsx` — add a `Guests | Directory` tab bar (currently has none).
- `frontend/src/App.jsx` — add the `/staff/dashboard/directory` route; change staff's index route to redirect to `guests` (matching the Admin/Dashboard layout pattern) so both tabs are addressable.

**Schema:** none required.

**Effort/Risk:** Low-medium. Backend is nearly trivial (3 handlers calling existing methods). No new privacy boundary — gate staff already indirectly sees resident name/unit via the guest-list join.

---

## Phase 3 — Developer/platform-admin directory + billing-status tag

### Platform directory
No backend change needed — `GET /api/platform/communities` already returns everything required. New `frontend/src/pages/platform/DirectoryPage.jsx`, filter chips built on `subscription_tier` (share the existing `TIER_LABELS` map from `CommunitiesPage.jsx` via `frontend/src/lib/constants.js` rather than duplicating it). New route + nav tab on `PlatformDashboardLayout.jsx` (currently has no tab bar at all).

### Billing-status tag
**Recommendation: actually populate and manage `subscriptions.status`** — the column already exists and is exactly the right shape; don't invent a parallel field.

- `backend/src/models/Subscription.js` **(new)** — `findByCommunity`, `createDefault`, `updateStatus`.
- `backend/src/models/Community.js` — extend `listWithCounts()` with a `LEFT JOIN subscriptions` for `subscription_status` (nullable — pre-existing communities show "Not set" until backfilled, not a crash).
- `backend/src/routes/platform.js` — onboarding (`POST /communities`) creates a default `subscriptions` row in the same transaction (`status: 'active'`); new `PUT /api/platform/communities/:id/billing-status` validates status is one of `active`/`trial`/`overdue`, calls `updateStatus`, logs an `AuditLog` entry (consistent with every other mutation in this codebase).
- **Manual backfill:** the one existing prod community (Lyford Cay, id 1) predates this and has no `subscriptions` row — needs a one-off `INSERT` via the documented `doctl apps console` method (base64/file approach, not inline `node -e`, per the `$`-expansion gotcha already in CLAUDE.md).
- Frontend: `platformApi.updateBillingStatus`; badges on `CommunitiesPage.jsx` and `CommunityDetailPage.jsx` with a small action to change status.

**Founder decision needed:** confirm the three status string values (`active`/`trial`/`overdue` or otherwise) — this is the first real write to a column that's sat unused, worth picking cleanly now.

**Effort/Risk:** Low-medium, all additive. Risk limited to the manual prod backfill step.

---

## Phase 4 — System Health screen

### Part A: per-community staleness indicator — ship now, zero schema changes
- `backend/src/models/AuditLog.js` — add `lastActivityByCommunity()` (`MAX(created_at)` grouped by `community_id`).
- `backend/src/routes/platform.js` — `GET /api/platform/system-health` merging community list + last-activity map.
- `frontend/src/pages/platform/SystemHealthPage.jsx` **(new)** — staleness badge per community (thresholds TBD, see below). New route + nav tab.

**Naming caveat:** `audit_logs` records guest-lifecycle/admin actions, **not HTTP requests**. A quiet community isn't necessarily unhealthy. Recommend labeling this "Last activity," not "Last successful request," to avoid overclaiming the signal.

**Founder decision needed:** staleness thresholds (24h/7d is a placeholder guess, not derived from any SLA) and the "Last activity" vs. "Last successful request" naming.

### Part B: recent-errors list — recommend deferring
Zero telemetry infrastructure exists today — this is 100% new work, not "surface existing data." DO App Platform already captures stdout/stderr (`doctl apps logs`), so there's already a way to see errors without building anything; it's just not in-app. A good in-app version implies alerting/dedup/rotation and still wouldn't catch DB drops or container OOM. Given pre-revenue, single-tenant status, recommend pointing at a real logging tool later rather than half-building telemetry now.

**If built anyway** (low-effort minimal version): new `error_logs` table (manual schema apply), `ErrorLog.create/listRecent`, a fire-and-forget call from the existing Express error middleware (must not itself throw), `GET /api/platform/errors`, and a second section on the System Health page.

**Founder decision needed:** build now vs. defer (recommend defer) — the single clearest "your call" item in the whole plan.

**Effort/Risk:** Part A low/low. Part B (if built) low-medium effort but genuinely new surface area touching every request path.

---

## Phase 5 — Profile click-through modal + call button

### New primitive: Modal
Recommendation: build one `Modal` using `createPortal` + `motion`'s `AnimatePresence`, matching this codebase's existing convention (`Banner`, `Button`, `Switch` all do this already) rather than native `<dialog>` (whose imperative API doesn't animate cleanly with Motion's enter/exit the way every other primitive here does).

One component, responsive via CSS breakpoints alone (centered dialog on desktop → bottom sheet on small viewports via `items-end sm:items-center` + rounded-corner classes) — no JS-side "is this mobile" branching, matching how the rest of the app already handles responsive layout (no `matchMedia` used anywhere today).

- `frontend/src/components/ui/Modal.jsx` **(new)** — `Modal`/`ModalHeader`/`ModalTitle`/`ModalBody` compound pattern (mirroring `Card`'s existing shape). Handles portal, `role="dialog" aria-modal`, Escape/click-outside close, basic focus trap + focus restore, `AnimatePresence` transitions.

### Call button — device detection
**Recommendation: always render the `tel:` link, no device detection at all.** `tel:` links degrade gracefully on desktop (no-op or OS handoff); available "is this mobile" signals (e.g. `matchMedia('(pointer: coarse)')`) are weak proxies for actual telephony capability and would add real complexity to solve a problem `tel:`'s own fallback behavior already solves. Matches the app's existing bias toward simplicity (no `matchMedia` usage exists anywhere today).

### Wiring
`AdminResidentsPage.jsx`, `StaffDirectoryPage.jsx`, and `DirectoryPage.jsx`'s office-contact rows all open the modal on row click, populated with name, unit (residents only), phone, and a `tel:` link styled via the existing `buttonVariants` pattern. One shared `DirectoryDetailModal.jsx` with an optional `unitNumber` prop rather than two near-duplicate modals.

**Schema:** none.

**Effort/Risk:** Medium — the one phase introducing a genuinely new, accessibility-sensitive primitive. Worth a manual keyboard-only/screen-reader pass before calling it done (no a11y linting exists in this project's tooling).

---

## Suggested build order
1. **Phase 1** first — purely additive/visual, ships independently once the dark-mode decision is made.
2. **Phase 2** next — the biggest net-new capability (gate staff currently has *no* resident visibility at all), small backend footprint.
3. **Modal (Phase 5's primitive)** should be built as soon as Phase 2 starts, not after Phase 4 — both Phase 2 and 3's directories need it for click-through.
4. **Phase 3** (billing tag) is independent, can run in parallel — different actor, different data.
5. **Phase 4 Part A** (staleness) is low-risk and independent; **Part B** (errors) is the one item to genuinely leave out of this batch pending a decision.

### Consolidated list of decisions needed before code is written
1. Dark-mode tokens: ship light-only for now, or block Phase 1 until dark equivalents are designed?
2. "Passage" → "Palisade" UI strings: bundle into this pass or defer to the full rename?
3. Drop the "Not on Palisade" concept for v1 (recommended), or is there already an answer to who maintains that roster?
4. The three billing-status string values to store in `subscriptions.status` (`active`/`trial`/`overdue` or otherwise).
5. "Last activity" vs. "Last successful request" naming, and staleness thresholds, for System Health Part A.
6. System Health Part B (errors list): build the minimal `error_logs` table now, or defer (recommended)?

### Critical files for implementation
- `frontend/src/index.css`
- `backend/src/routes/staff.js`
- `backend/src/routes/platform.js`
- `backend/src/models/Community.js`
- `frontend/src/components/ui/Avatar.jsx`
- `schema.sql`
</content>
