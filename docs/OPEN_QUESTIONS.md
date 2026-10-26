---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# Open Questions & Known Ambiguities

Every item was found by reading code at `5ec7e9c` (+ working tree) on 2026-10-23. None is fixed yet. Items marked
**bug?** look like defects, but intent wasn't confirmed, so they are recorded rather than "fixed by doc".
When you resolve one, delete its row and record the outcome in [DECISIONS.md](DECISIONS.md) if it was a choice.

## Active Questions Table

| ID | Topic / Question | Affected Code | Conflicting Evidence / Current Status | What Would Resolve It |
|---|---|---|---|---|
| Q-001 | **Security:** `JWT_SECRET` falls back to `"dev-secret"` | `src/lib/auth.ts`, `src/middleware.ts` | Unset in prod → forgeable sessions | Fail fast when unset in production |
| Q-002 | **Security bug?** Any signed-in user lists up to 100 users from all tenants (name + email); `q` is an unescaped regex | `GET /api/users`, `GET /api/search` (users part) | Comment says it's for member pickers; no non-admin caller exists | Scope to caller's workspaces; escape regex |
| Q-003 | Assigning a paid plan doesn't clear a past `planExpiresAt` → workspace stays expired | `src/app/(app)/admin/page.tsx`, `src/lib/plans.ts:resolveStatus` | Super admin must clear the end-date field by hand | Clear/extend on plan change, or warn in UI |
| Q-004 | Trial gaps: workspaces missing plan fields never expire; anyone can create a new workspace for a fresh trial; `trialEndsAt` not patchable (can't extend) | `src/lib/plans.ts`, `src/app/api/workspaces/route.ts` | No backfill migration exists in repo | Product decision + backfill migration |
| Q-005 | Trial length / tier copy: 14 vs 15 days; trial = "Business features" vs schema default plan `pro` | `src/lib/plans.ts` (`TRIAL_DAYS`, header, `PLANS.trial.tagline`), `src/app/page.tsx` metadata, admin page | Code uses 15 days on `pro` | Pick one; fix copy |
| Q-006 | Per-tier caps (seats, projects, sprints…) are display-only | `src/lib/plans.ts:PLANS` | No route reads `limits` | Decide whether/when to enforce |
| Q-007 | Root migrations referenced but missing (`migration.js`, plan/task-type/role backfills) | root `AGENTS.md`, `ProjectSchema.taskTypes` comment | Not in tree or git history; runtime falls back to `DEFAULT_TASK_TYPES` | Recreate & commit, or confirm prod data is already clean | <!-- verify:ignore -->
| Q-008 | `npm run typecheck` OOMs (8 GB) — no type gate exists | `tsconfig.json`, `next.config.ts` | Pre-existing at `5ec7e9c` | Find the type explosion (Mongoose/RTK generics?) |
| Q-009 | `npm run seed` broken (`--env-file=.env.local`, file deleted); seeded bcrypt users can't log in via Firebase; seeded workspace has no trial fields | `package.json` scripts, `scripts/seed.mjs` | README demo-accounts table is therefore untrue | Fix script + create Firebase users, or drop the seed |
| Q-010 | Lint fails: `react-hooks/purity` (`Date.now()` in render) | `src/components/PlanBadge.tsx` | Pre-existing | Move time read to effect/state |
| Q-011 | **bug?** Sprint start/complete notify only `project.members` (guests) | `src/app/api/sprints/[id]/route.ts` | Workspace members never notified | Notify everyone with project access |
| Q-012 | **bug?** `GET /api/tasks`: `sprint=active` advertised but not implemented (500); `q` unescaped regex (500 on `(`) | `src/app/api/tasks/route.ts` | — | Implement/remove; escape or use the existing text index |
| Q-013 | **bug?** `POST /api/tasks` (quick-create into a Done column) and duplicate don't set `completedAt`; project status removal remaps tasks via raw `updateMany`; reorder/bulk accept unknown status ids | tasks routes, `PATCH /api/projects/[id]` | Breaks Done calendar/velocity for those tasks | Route all through the shared side-effects ([api/tasks.md](api/tasks.md#status-write-paths)) |
| Q-014 | **bug?** List view inline assignee uses `project.members` (guests only) | `src/app/(app)/p/[projectId]/list/page.tsx` | Other pickers use `projectAssignees` | Use `projectAssignees` |
| Q-015 | `excludedMembers` not honoured by `GET /api/projects`, dashboard data, search, cross-project task lists | those routes | `getProjectRole` honours it | Apply the same filter everywhere |
| Q-016 | Burndown `sprint=` not checked against the project | `src/app/api/reports/[projectId]/route.ts` | Cross-project sprint data readable | Validate sprint.project |
| Q-017 | Read-only 403s are inconsistent: project/task writes return the generic "permission" message, workspace writes return `READ_ONLY_MESSAGE`; member DELETE intentionally unblocked | `src/lib/permissions.ts` callers | See ADR-002 | Decide on one message |
| Q-018 | `?task=` deep link only works on the board; deleted/forbidden task spins forever | `src/app/(app)/p/[projectId]/board/page.tsx`, `src/components/TaskModal.tsx` | Copy link always points at `/board` | Handle in all views + error state |
| Q-019 | Silent truncation: board/backlog/timeline/calendar fetch `limit=200`, Done calendar 200/month, My Tasks 100 | those pages | Fine for ICP size? | Paging or a visible "showing first N" |
| Q-020 | Error UX: `useQ` drops RTK `error`; TaskModal/backlog handlers lack try/catch; no `error.tsx`/`not-found.tsx`; malformed ObjectIds → HTML 500; auth 500s echo raw `detail` | `src/store/hooks.ts`, pages, auth routes | — | Error states + id validation | <!-- verify:ignore -->
| Q-021 | Login `?next=` not checked for a relative path (possible open redirect, inferred) | `src/app/(auth)/login/` | — | Allow only `/`-relative paths |
| Q-022 | Deleting a workspace/project orphans comments, activity, invites, filters, notifications, dashboard refs | `DELETE /api/workspaces/[id]`, `DELETE /api/projects/[id]` | — | Cascade or tombstone |
| Q-023 | Admins can delete projects though `ROLE_DESCRIPTIONS` implies owner-only | `src/lib/constants.ts:ROLE_CAPS` | — | Confirm intent |
| Q-024 | Next 16 deprecations: `src/middleware.ts` (→ `proxy`), `eslint` key in `next.config.ts`; unused deps `swr`, `date-fns`, file `src/lib/client.ts` | — | Read `node_modules/next/dist/docs/` first | Planned cleanup (`prepare` mode) |
| Q-025 | Prod Firebase web config is hard-coded in `src/lib/firebase/client.ts` (no build args); README/cloudbuild omit `FIREBASE_SERVICE_ACCOUNT`; Vercel still mentioned in comments | Firebase + deploy files | Is Vercel still live? | Confirm hosting; document build args |
| Q-026 | No product analytics, no success metrics, no "why now" | — | [02-business-goals.md](02-business-goals.md) | Human decision |

---

## Detailed Issue Records

### Q-003
- **The ambiguity:** `resolveStatus` treats `active` + past `planExpiresAt` as expired. The admin plan dropdown sets `active` but keeps the old end date.
- **Risk:** a paying customer stays locked read-only after the super admin "upgrades" them.
- **What resolves it:** clear or extend `planExpiresAt` when a paid plan is assigned, or show a warning next to the date.

### Q-009
- **The ambiguity:** passwords moved to Firebase (`79ab40a`), but `scripts/seed.mjs` still writes bcrypt hashes. A model comment mentions a migration that imports passwords into Firebase. It isn't in the repo.
- **Safe test-data guidance meanwhile:** register a fresh account through `/register` against a non-production database. Never seed into the production cluster.

---

## Known Technical Limitations & Verification Gaps
- **Typecheck:** unavailable (OOM). Changes can only be checked with lint, targeted reading, and the running app.
- **Tests:** none exist ([19-testing.md](19-testing.md)). Browser checks need a logged-in Firebase user. The in-app browser couldn't reach the user's dev server on 2026-10-23.
- **Production state:** which cluster is production, and whether the missing migrations ran there, can't be seen from the repo.
