---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# Architectural & Design Decisions (ADRs)

Read before undoing anything that looks odd: most of these were learned the hard way. Evidence is a
commit SHA, a code comment, or a user confirmation. Add an entry whenever direction or architecture changes.

## Decision Index

| Date | Decision Record | Status | Area Affected | Key Rationale |
|---|---|---|---|---|
| 2026-10-23 | [ADR-001: Hosted per-seat SaaS for Indian teams](#adr-001-hosted-per-seat-saas-for-indian-teams) | Accepted | Product | User-confirmed direction |
| 2026-10-22 | [ADR-002: Expired trial/plan → read-only for every role](#adr-002-expired-trialplan--read-only-for-every-role) | Accepted (supersedes "display-only v1") | Billing / RBAC | Trial must mean something; never delete data |
| 2026-07-24 | [ADR-003: Four roles, workspace grants all projects](#adr-003-four-roles-workspace-grants-all-projects) | Accepted | RBAC | One role model everywhere |
| 2026-07-28 | [ADR-004: SWR → RTK Query with optimistic updates](#adr-004-swr--rtk-query-with-optimistic-updates) | Accepted | Client state | UI-first edits with rollback |
| 2026-07-28 | [ADR-005: Firebase for identity, app JWT for session](#adr-005-firebase-for-identity-app-jwt-for-session) | Accepted | Auth | Password reset email without own mailer |
| 2026-07-28 | [ADR-006: Super admin anchored to one email](#adr-006-super-admin-anchored-to-one-email) | Accepted | Auth | Can't be granted by editing a role |
| 2026-07-28 | [ADR-007: Labels became a multiselect custom field](#adr-007-labels-became-a-multiselect-custom-field) | Accepted | Data model | One generic field system |
| 2026-07-30 | [ADR-008: Per-project task types](#adr-008-per-project-task-types) | Accepted | Data model | Process differs per project |
| 2026-07-30 | [ADR-009: `defineModel()` recompiles models in dev](#adr-009-definemodel-recompiles-models-in-dev) | Accepted | Data layer | New fields were silently stripped |
| 2026-07-30 | [ADR-010: Skip tsc/eslint inside `next build`](#adr-010-skip-tsceslint-inside-next-build) | Accepted (debt) | Build | Build OOM on Cloud Build |
| 2026-07-31 | [ADR-011: Every status write path applies the same side-effects](#adr-011-every-status-write-path-applies-the-same-side-effects) | Accepted | Tasks | Board-completed tasks lost `completedAt` |
| 2026-07-31 | [ADR-012: Per-widget dashboard fetch with a stable range token](#adr-012-per-widget-dashboard-fetch-with-a-stable-range-token) | Accepted | Dashboards | Per-widget filters without refetch thrash |

---

## ADR-001: Hosted per-seat SaaS for Indian teams
- **Status:** Accepted. Supersedes the earlier "self-hostable, no billing, no per-seat lock-in" vision.
- **Context:** the original docs described a self-hostable tool. Commit `22ff6f3` added INR plans, a trial and a landing page.
- **Decision:** Kanbo is a hosted SaaS sold per workspace/seat to small Indian software teams. Prices live only in
  `src/lib/plans.ts:PLANS`. It ships by pushing `master` → Cloud Run.
- **Evidence:** confirmed by the user, 2026-10-23; `src/app/page.tsx` landing copy.
- **Consequences:** [01-product-vision.md](01-product-vision.md) is the authority. Self-hosting is not a goal.

## ADR-002: Expired trial/plan → read-only for every role
- **Status:** Accepted (working tree, 2026-10-22). Supersedes the "v1 billing is display-only" removal.
- **Context:** `22ff6f3` added a read-only capability collapse on expiry. `930db0f` removed it the same day: paid
  workspaces still stored as `subscriptionStatus: "trialing"` with a lapsed `trialEndsAt` locked admins out of
  commenting. After that removal, users kept full access after their trial ended.
- **Decision:** `src/lib/permissions.ts:getCapabilities` returns only `project:view` when
  `isProjectReadOnly` is true. Workspace-level writes (project create, workspace rename, member add/role change)
  return 403 with `READ_ONLY_MESSAGE`. Project/task GETs expose `readOnly` for the UI banner. Assigning a paid plan in
  `/admin` sets `subscriptionStatus: "active"`, so a stale trial date can't lock a paying customer.
- **Deliberately allowed while expired:** leaving / removing workspace members (seat cleanup before choosing a plan),
  accepting invites, deleting the workspace, personal dashboards and saved filters.
- **Rejected:** display-only billing (users could keep working forever); deleting data on expiry (FAQ promises
  nothing is deleted).
- **Remaining risk:** a past `planExpiresAt` keeps a paid workspace expired. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md#q-003).

## ADR-003: Four roles, workspace grants all projects
- **Status:** Accepted.
- **Decision:** owner > admin > editor > viewer at both levels (`src/lib/constants.ts:ROLE_CAPS`). Workspace
  membership grants every project; `project.members` holds guests only. `excludedMembers` (`5f0eda6`) removes a member from one project.
- **Evidence:** `193e077` replaced the earlier project_admin/team_lead/developer/qa roles and the custom-role builder.
  `930db0f` added `rankOf` in `src/lib/permissions.ts:getProjectRole`. Legacy DB role names had zeroed out permissions,
  and an unknown guest role shadowed `owner`.
- **Rejected:** adding legacy role names as extra roles. The legacy data was normalized by a one-off `migration.js` <!-- verify:ignore -->
  that was never committed.

## ADR-004: SWR → RTK Query with optimistic updates
- **Status:** Accepted. `swr` is still in `package.json` but is unused.
- **Decision:** RTK Query endpoints in `src/store/api.ts`, keyed by URL so the migration was mechanical, plus SWR-shaped
  `useQ` adapters in `src/store/hooks.ts`. Edits patch the cache first and undo on failure.
- **Evidence:** `9b332de` (PR #1, merged `e1e589b`). `79ab40a` resets the API state on logout because the singleton
  store leaked the previous user's data.
- **Footgun:** the optimistic `updateTask` skips reference fields, since the GET returns populated objects (comment in `src/store/api.ts`).

## ADR-005: Firebase for identity, app JWT for session
- **Status:** Accepted.
- **Decision:** Firebase Auth owns credentials (email/password, Google, password-reset email). The server verifies the
  ID token with firebase-admin, then mints its own `sm_session` JWT, so `src/middleware.ts` and route guards stay unchanged.
- **Evidence:** `79ab40a`. `584e541` added tolerant parsing of `FIREBASE_SERVICE_ACCOUNT` (raw, base64 or
  double-stringified) and lazy init, because hosting dashboards mangled the key and eager init caused opaque 500s.
- **Consequence:** seeded bcrypt users can't log in ([OPEN_QUESTIONS.md](OPEN_QUESTIONS.md#q-009)).

## ADR-006: Super admin anchored to one email
- **Status:** Accepted. `src/lib/constants.ts:SUPER_ADMIN_EMAIL` decides, not a DB role (`79ab40a`).
- **Rejected:** "first registered account becomes super admin". A mutable role field could be granted by editing data.

## ADR-007: Labels became a multiselect custom field
- **Status:** Accepted (`f44a142`). `Project.labels`/`Task.labels` and `/api/projects/[id]/labels` were removed. New projects
  seed a `labels` multiselect field, and editors add options inline via `POST /api/projects/[id]/field-options`.

## ADR-008: Per-project task types
- **Status:** Accepted (`97f2931`). The global type enum became `ProjectSchema.taskTypes`. `epic` and `subtask` are system
  types and can't be deleted. Removing a type that is in use returns 422 instead of silently remapping tasks.
- **Sync pairs:** `CURATED_TYPE_ICONS` (`src/lib/constants.ts`) must match `TYPE_ICON_REGISTRY` (`src/components/ui.tsx`).
  The curated icon list keeps the bundle small.

## ADR-009: `defineModel()` recompiles models in dev
- **Status:** Accepted (`97f2931`). Fast Refresh kept stale compiled Mongoose models, and strict mode silently stripped new
  fields on write while the request still returned 200. The `defineModel` helper in `src/models/index.ts` drops and
  recompiles models outside production. Never reintroduce `models.X || model(...)`. Root `AGENTS.md` keeps the full rule.

## ADR-010: Skip tsc/eslint inside `next build`
- **Status:** Accepted as debt (`90fc712`; comment in `next.config.ts`). `next build` was OOM-killed on Cloud Build.
- **Consequence:** `npm run typecheck` also runs out of memory locally (8 GB heap, confirmed 2026-10-22 at `5ec7e9c`), so
  **no gate catches type errors today**. See [19-testing.md](19-testing.md).

## ADR-011: Every status write path applies the same side-effects
- **Status:** Accepted (`5ec7e9c`).
- **Context:** the board did reorder then PATCH. Reorder set the raw status, so the PATCH saw no change, and
  `completedAt`, activity and notifications were all lost. The Done calendar was empty for tasks completed on the board.
- **Decision:** `PATCH /api/tasks/[id]`, `POST /api/tasks/reorder` and `PATCH /api/tasks/bulk` each set
  `completedAt`/`startedAt`, log activity and notify, per task. Details: [api/tasks.md](api/tasks.md#status-write-paths).
- **Rejected:** relying on the client's follow-up PATCH (race, no diff). That PATCH is now redundant.

## ADR-012: Per-widget dashboard fetch with a stable range token
- **Status:** Accepted (`b3ed8f6`). Each widget fetches its own data, deduplicated by RTK Query, so per-widget filters work.
  Ranges travel as a token (e.g. a named range), not as timestamps that change every render and thrash the cache.
  `Dashboard.filters` is an explicit sub-schema because a `type` key collides with Mongoose's reserved `type`.

---

## Lessons Learned & Incident Log
- **Login 500 on a phone hotspot (2026-10-23).** Root cause: the hotspot's DNS returns a bad response for Atlas's
  `mongodb+srv` SRV record (`querySrv EBADRESP`). **Prevention:** set `MONGODB_DNS_SERVERS` locally
  ([15-environment-setup.md](15-environment-setup.md)). Check `.next/dev/logs/next-development.log` first when every API 500s.
- **New schema field "doesn't save" (recurring).** Root cause: a stale model plus Zod stripping unlisted fields.
  **Prevention:** ADR-009, add the field to the route's Zod schema, and confirm the value round-trips after a refetch.
- **Paid workspace locked out (2026-07-29).** Root cause: plan set but status left `trialing`. **Prevention:** the plan
  dropdown in `/admin` sets the status to `active` (ADR-002).
- **Migrations not committed.** The `migration.js` files that normalized roles and backfilled plans and task types were <!-- verify:ignore -->
  run locally and never committed. **Prevention:** commit every root migration with the change that needs it (root `AGENTS.md` rule).
