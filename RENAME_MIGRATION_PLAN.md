# Passage/Threshold → Palisade/Argus Migration Plan

*Researched 2026-08-30. Read-only research only — nothing below has been executed.*

## Executive Summary

Verified the actual current state of the repo and infra spec, which changes the risk profile in your favor on a few points — most importantly, **the domain rename requires zero frontend code changes** (API calls are same-origin), and **the GitHub repo is already named `hoa`, not `passage`** — it was never brand-named, so renaming it is a pure cosmetic option, not a required step. `doctl` was **not installed in the research sandbox** despite CLAUDE.md claiming it's pre-authenticated — that needs re-verifying in whatever shell actually executes the cutover commands.

Given this is pre-revenue, $0 MRR, with 3 test communities (one — "Lyford Cay" — already has real onboarded data in the live, backup-less dev-tier DB), the overall recommendation is: **do Phase 1 (code strings) now, defer everything else until there's a real reason** (public launch, or a real prospective customer about to see the domain). Infra rename for a pre-revenue app with zero external users pointing at the domain is largely vanity work with real downside risk (DB data loss, auth lockout, TLS cert gaps) and near-zero upside today.

---

## Verified Current State (read-only research findings)

| Item | Finding |
|---|---|
| GitHub remote | `https://github.com/whereIsRico/hoa` — repo is named **`hoa`**, not `passage`. Never brand-named. |
| Local git state | `main` is 1 commit ahead of `origin/main` (unpushed). `VISION.md` has unstaged edits. Untracked: `argus-a-lens.pdf`, `argus-word-integrated.pdf`, `idk.png` at repo root. |
| `.do/app.yaml` | `name: passage`; backend env vars reference `${passage-db.HOSTNAME/PORT/DATABASE/USERNAME/PASSWORD}`; database resource named `passage-db`; `domain: passage.whereisrico.dev`; `github: repo: whereIsRico/hoa` for both services. |
| `doctl` | **Not found** in the research sandbox — contradicts CLAUDE.md's claim it's pre-authenticated "in this environment." Re-verify in whichever shell will run the actual cutover. |
| `package.json` names | Both `backend/package.json` and `frontend/package.json` already use generic names (`"backend"`, `"frontend"`) — no rename needed. |
| CI/CD | No `.github/workflows` — nothing to update there. DO watches `whereIsRico/hoa` directly via the app spec. |
| `VITE_API_URL` | `""` in production, consumed via `??` (not `||`) — frontend makes same-origin relative requests. No hardcoded domain/API URL anywhere in code. **Domain cutover needs zero frontend code changes.** |
| `.env` files | `backend/.env`/`.env.example` have `DB_USER=passage` — local dev convention only, unrelated to prod (prod credentials come from DO's auto-generated binding values). No risk, no urgency. |
| Prod data | Platform admin `rico@threshold.dev` (real mailbox) and one onboarded community "Lyford Cay" with admin `jeremiah@test.com` already exist in the live, backup-less dev-tier DB. |
| DB access | VPC-only — no public `psql`. Reaching it requires the `doctl apps console` PTY workaround documented in CLAUDE.md. |

---

## Complete Inventory of Code-Level "Passage"/"Threshold" Occurrences

| File | Line(s) | String | Category |
|---|---|---|---|
| `schema.sql` | 111 | `-- Platform admins (Threshold staff...)` | Cosmetic comment — safe anytime |
| `backend/src/index.js` | 29 | `message: 'Passage API is running'` | Cosmetic health-check response string |
| `frontend/index.html` | 7 | `<title>Passage</title>` | Cosmetic — browser tab title |
| `frontend/index.html` | 10 | `localStorage.getItem('passage.theme')` | **Live localStorage key** — rename resets dark/light pref for existing sessions until next toggle |
| `frontend/src/components/ThemeToggle.jsx` | 6, 16 | `localStorage` key `passage.theme` | Same key — must move in lockstep with `index.html` |
| `frontend/src/components/AuthLayout.jsx` | 15 | Displayed text `Passage` | Cosmetic UI brand text |
| `frontend/src/context/AuthContext.jsx` | 4 | `STORAGE_KEY = 'passage.token'` | **Live auth token key** — renaming force-logs-out every active resident/admin session |
| `frontend/src/context/PlatformAuthContext.jsx` | 4 | `STORAGE_KEY = 'passage.platformToken'` | Same — force-logs-out `rico@threshold.dev`'s active session |
| `frontend/src/context/StaffAuthContext.jsx` | 4 | `STORAGE_KEY = 'passage.staffToken'` | Same — force-logs-out gate staff sessions |
| `frontend/src/pages/DashboardLayout.jsx` | 26 | Displayed text `Passage` | Cosmetic UI brand text |
| `frontend/src/pages/platform/PlatformDashboardLayout.jsx` | 16 | Displayed text `Passage` | Cosmetic UI brand text |
| `frontend/src/pages/StaffDashboardLayout.jsx` | 16 | Displayed text `Passage` | Cosmetic UI brand text |
| `frontend/src/pages/platform/PlatformLoginPage.jsx` | 34 | `"Threshold internal — onboard and manage communities"` | Cosmetic UI subtitle |
| `.do/app.yaml` | 1 | `name: passage` | **Live infra identifier** — sequence with Phase 4 |
| `.do/app.yaml` | 26,28,30,32,35 | `${passage-db.*}` env interpolation | **Live infra identifier** — sequence with Phase 5 |
| `.do/app.yaml` | 55 | `name: passage-db` | **Live infra identifier** — sequence with Phase 5 |
| `.do/app.yaml` | 60 | `domain: passage.whereisrico.dev` | **Live infra identifier** — sequence with Phase 3 |

**Not found:** no CI/CD workflow references; both `package.json`s already generic; `frontend/README.md` is unmodified Vite boilerplate; no hardcoded API URLs/domains in JS/JSX.

---

## Phase 0 — Pre-flight Housekeeping (blocking, unrelated to rename itself)

- `VISION.md` has unstaged edits — decide if these get committed as part of, or before, the rename work.
- `argus-a-lens.pdf`, `argus-word-integrated.pdf`, `idk.png` are untracked at repo root — decide whether brand assets belong in the repo (probably a `brand/`/`docs/` subfolder, not root) or should stay out via `.gitignore`.
- Local `main` is 1 commit ahead of `origin/main` — push or reconcile before starting a rename branch.
- **Verify `doctl` and `gh` are actually available and authenticated** in whatever shell will execute Phase 3/4 — this research sandbox did not have `doctl`.

Rollback: N/A — pure cleanup.

## Phase 1 — Code-Level String Rename (lowest risk, do this now if doing anything)

**Safe, pure-cosmetic renames** (one PR): `schema.sql:111`, `backend/src/index.js:29`, `frontend/index.html:7` `<title>`, and all UI brand text in `AuthLayout.jsx`, `DashboardLayout.jsx`, `PlatformDashboardLayout.jsx`, `StaffDashboardLayout.jsx`, `PlatformLoginPage.jsx`.

**Renames needing care, not a blind find-replace:**
- `passage.theme` → `palisade.theme` (`index.html` + `ThemeToggle.jsx`): existing browsers silently fall back to OS preference once — harmless, or read the old key as a one-release fallback to avoid a theme flash.
- `passage.token` / `passage.platformToken` / `passage.staffToken` → `palisade.*` in the three `*AuthContext.jsx` files: **will log out every active session** the moment the new build deploys. Non-event for 3 test communities, but plan to give `rico@threshold.dev` and `jeremiah@test.com` a heads-up rather than treating it as invisible.

**Explicitly deferred, do NOT touch in Phase 1:** `.do/app.yaml`'s `name: passage`, `passage-db`, `domain: passage.whereisrico.dev` — live resource identifiers, not display strings. Editing the file alone does nothing until a `doctl apps update --spec` is run, so bundling these into Phase 1 is either inert or silently triggers Phase 3/4/5 risk without the surrounding safeguards below.

Rollback: `git revert`; redeploy. Fully reversible; only side effect is another one-time forced logout if reverting the token-key renames.

## Phase 2 — GitHub Repo Rename (optional, lower priority than assumed)

**The repo is already named `hoa`, not `passage`** — never branded. This turns a "necessary" rename into a pure preference call: rename `whereIsRico/hoa` → `whereIsRico/palisade`, or leave it (arguably the more honest technical name, zero brand debt).

If renaming: `gh repo rename palisade` — GitHub auto-redirects the old URL/API indefinitely. Local remote URL doesn't need manual updating (GitHub's redirect keeps pushes/pulls working), though `git remote -v` afterward is worth a sanity check.

**Coupling to watch:** `.do/app.yaml`'s `github: repo: whereIsRico/hoa` (both services) must be updated in the same spec push as Phase 4 if you rename the repo, or DO's GitHub integration may fail to find the repo on the next auto-deploy — this is not actually independent of the DO update step.

Rollback: `gh repo rename hoa` back; GitHub's redirect handles either direction gracefully.

## Phase 3 — Domain/DNS Cutover

**Decision point, don't assume:** confirm the new domain (`palisade.whereisrico.dev` is the obvious parallel) before proceeding.

1. Create a **new** Route53 CNAME → DO's default ingress. Don't touch/delete the existing `passage.whereisrico.dev` record yet.
2. Add (don't replace) the new domain in `.do/app.yaml`'s `domains:` block.
3. `doctl apps update 124a987b-407c-48e0-a2e3-6d9125a996d5 --spec .do/app.yaml`.
4. Wait for DO's automatic TLS issuance on the new domain (can take minutes).
5. Verify the new domain end-to-end (load, log in, hit an API route) **before** touching the old one.
6. **Decision point:** once verified, either remove `passage.whereisrico.dev` and let the Route53 record lapse, or keep it alive as a redirect indefinitely. For zero external users, removing is almost certainly fine — but it's your call.

Because of the same-origin `VITE_API_URL=""` setup, this phase needs **no frontend rebuild or code change**.

Rollback: near risk-free — both domains can coexist; if the new one misbehaves, just don't remove the old one.

## Phase 4 — DO App Rename

Whether the app's `name` field (currently `passage`) is mutable via `doctl apps update --spec`, or requires recreation, **could not be verified from this sandbox** (no `doctl`). Confirm in the real environment before acting, and confirm whether bundling this with the `passage-db` binding rename (Phase 5) is safe.

**Recommendation:** the DO app name isn't user-facing anywhere (users see the domain, not the DO app name) — it's bookkeeping only. If recreation turns out to be required, **skip this entirely**; real risk of an extended outage for zero user-facing benefit. If confirmed to be a safe in-place metadata update, fine to do, but don't bundle it with Phase 3's user-facing domain cutover.

Rollback: if recreation was needed, keep the old app running untouched until the new one is fully verified.

## Phase 5 — Database

**Recommendation: leave it named `passage-db` and don't touch it — flagged as not worth doing at all, not just deferrable.**

- It's a DO App Platform bound "dev database" — **no automated backups, no HA**. Any operation that risks DO reinterpreting a name change as "delete old, provision new" is a real, uninsurable data-loss risk.
- The name is purely internal — nothing external ever sees `passage-db`; it's only referenced inside `.do/app.yaml`'s own env-var interpolation. Zero user- or even developer-facing benefit.
- Prod already has real, non-trivial-to-recreate data (the "Lyford Cay" community + admin), and the only way to inspect/fix the DB under pressure is the slow `doctl apps console` PTY workaround.
- If ever attempted: take a manual `pg_dump` via the console workaround first (no existing backup to fall back on), then rename, then verify integrity the same way. Real effort, no external payoff.

**If this ever happens, piggyback it onto the already-planned upgrade to a production-tier managed Postgres** (before onboarding a real paying HOA), rather than doing it standalone now.

## Phase 6 — Login Email Migration (out-of-band, manual, not a code task)

`rico@threshold.dev` is a real mailbox that must exist and be reachable for password resets/notifications — not a value to swap in a script. Prerequisites:
1. Actually own/control a domain for the new identity (e.g. `argus.dev` or whatever's chosen — another decision point).
2. Set up mail routing (MX records, a mailbox provider, or at minimum a catch-all forward).
3. Only then update the `platform_admins` row's email in the live DB via the documented `doctl apps console` workaround — mind the `$`-expansion bug already noted in CLAUDE.md when embedding bcrypt hashes or new values.
4. Test login end-to-end with the new email before retiring the old one.

Track this as a manual checklist item for Rico, not automation — fully decoupled from Phases 1-5, can start whenever the mail prerequisites are real.

---

## Rollback Summary by Phase

| Phase | Rollback |
|---|---|
| 0 | N/A — cleanup only |
| 1 | `git revert` + redeploy; one-time forced logout if reverting token-key renames |
| 2 | `gh repo rename` back; GitHub's redirect is safe either direction. Revert `.do/app.yaml`'s `github.repo` too if changed in lockstep. |
| 3 | Keep old domain's Route53 record + `.do/app.yaml` entry until new domain fully verified; no user impact if new one fails |
| 4 | If in-place: revert spec's `name` field. If recreation: keep old app running untouched until new one is proven. |
| 5 | Recommended: don't do it. If attempted: restore from the manual `pg_dump` taken beforehand — no other safety net. |
| 6 | Keep old mailbox/DB value functional in parallel until the new one is proven end-to-end |

---

## Sequencing Recommendation (honest priority call)

Given pre-revenue, 3 test communities, $0 MRR, no external users depending on the current domain or brand:

1. **Do now, cheaply:** Phase 0 + Phase 1 — a few hours of low-risk work that syncs the code's identity with the already-updated docs (CLAUDE.md, VISION.md, Notion).
2. **Defer indefinitely, arguably skip forever:** Phase 5 (DB rename) — real risk, zero payoff. Only worth doing if piggybacked onto the already-planned production-tier Postgres upgrade.
3. **Defer until there's an actual reason:** Phases 2, 3, 4 (repo rename, domain cutover, DO app rename). No user-facing urgency today — nobody outside Rico and the 3 test communities has `passage.whereisrico.dev` bookmarked or linked anywhere public. Do these together, in one focused session, right before actually showing the product to a real prospective customer or going public — not before.
4. **Start whenever the prerequisites are real, independent of the above:** Phase 6 (login email) — has its own timeline gated by owning/configuring a mail domain.

**Bottom line:** this is a naming decision already fully reflected in the docs. The code/infra rename is nice-to-have hygiene, not urgent infrastructure work. Treat Phase 1 as "worth an afternoon"; treat everything downstream as "do the week before the new domain/repo name actually needs to be true, not before."

### Critical files for Phase 1 implementation
- `.do/app.yaml`
- `frontend/index.html`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/PlatformAuthContext.jsx`
- `frontend/src/context/StaffAuthContext.jsx`
- `frontend/src/components/ThemeToggle.jsx`
- `schema.sql`
- `backend/src/index.js`
</content>
