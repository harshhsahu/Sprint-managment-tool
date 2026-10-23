# Kanbo (sprint-management)

Hosted, per-seat agile task-management SaaS (kanban, sprints, backlog, timeline, dashboards, reports) for small
Indian software teams. It's one Next.js 16 App Router app: client pages, `/api/**` route handlers, Mongoose on
MongoDB Atlas, Firebase for sign-in. It deploys to Google Cloud Run.

## Commands

| Task | Command | Status (2026-10-23) |
|---|---|---|
| Install dependencies | `npm install` | — |
| Run dev server | `npm run dev` → http://localhost:3000 | Works. Restart after editing `src/lib/*`, `src/models/*`, route Zod schemas or `.env` |
| Build for production | `npm run build` | Skips tsc + eslint by design ([ADR-010](docs/DECISIONS.md#adr-010-skip-tsceslint-inside-next-build)) |
| Lint | `npm run lint` | Runs; exits 1 on one existing error in `src/components/PlanBadge.tsx` (+3 existing `exhaustive-deps` warnings) |
| Type check | `npm run typecheck` | **Runs out of memory** even with 8 GB. No type gate today |
| Lint only what you touched | `npx eslint <files>` | Use this as the minimum gate |
| Tests | — | None exist |
| Seed demo data | `node --env-file=.env scripts/seed.mjs` | `npm run seed` is broken (`.env.local` is gone); seeded users can't sign in via Firebase | <!-- verify:ignore -->
| Run a migration | `node --env-file=.env migration.<ts>.js` | No dotenv dependency, so pass `--env-file` |
| Check docs | `python3 <ai-docs skill>/scripts/verify_docs.py .` | 0 errors expected |

## Reading Order Before You Change Code

1. **Purpose & boundaries:** [docs/01-product-vision.md](docs/01-product-vision.md). Judge the request against the ICP, principles and non-goals; never invent vision or fake integrations.
2. **Mental model:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the rulebook [docs/AGENTS.md](docs/AGENTS.md).
3. **The journeys you touch:** [docs/04-user-journeys.md](docs/04-user-journeys.md) → the matching [docs/modules/](docs/modules/) doc.
4. **Contracts:** [docs/api/](docs/api/), [docs/database/entities.md](docs/database/entities.md), [docs/12-api-guidelines.md](docs/12-api-guidelines.md).
5. **UI:** [docs/10-design-system.md](docs/10-design-system.md), [docs/ui/](docs/ui/).
6. **State, setup & verification:** [docs/11-state-management.md](docs/11-state-management.md), [docs/15-environment-setup.md](docs/15-environment-setup.md), [docs/19-testing.md](docs/19-testing.md), [docs/22-definition-of-done.md](docs/22-definition-of-done.md); shipping: [docs/23-git-workflow.md](docs/23-git-workflow.md), [docs/20-deployment.md](docs/20-deployment.md).
7. **History & unknowns:** [docs/DECISIONS.md](docs/DECISIONS.md), [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md). Full map: [docs/README.md](docs/README.md).

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Database migrations

<!-- verify:ignore-start -->

The database layer uses Mongoose (MongoDB) — models live in `src/models/`.

Whenever a change touches the DB level — a new model, a new/renamed/removed field, a changed type, a new index, or a required backfill of existing documents — you MUST create a corresponding `migration.js` at the **root level** of the repo alongside the code change.

Rules:
- Name it `migration.js` (or, if one already exists, add a new timestamped file `migration.<YYYYMMDDHHMM>.js` so existing migrations are not overwritten).
- Make it runnable standalone with `node migration.js`; connect using the same connection string / env var the app uses (e.g. `MONGODB_URI`).
- Each migration must be **idempotent** — safe to re-run without duplicating or corrupting data.
- Include both the forward change and, where feasible, a documented rollback (an `down`/revert path or clear inline notes).
- Log a clear summary of what was changed and how many documents were affected.
- Schema-only edits in `src/models/` with no impact on existing stored documents do not need a migration; anything that alters the shape or integrity of data already in the database does.
- Load env explicitly: there is no dotenv dependency, so run it as `node --env-file=.env migration.js`.
- **Commit the migration file.** Earlier migrations were run locally and never committed, so none exist in the repo ([Q-007](docs/OPEN_QUESTIONS.md)).

<!-- verify:ignore-end -->

## Mongoose model caching — new schema fields "silently don't save"

Symptom (recurs on **every** new project/task/etc. field): a PATCH sends the correct payload, the API returns 200, but the new field never persists and the UI shows the old value after refetch.

Cause: Mongoose caches compiled models on its module-global `mongoose.models` registry. When a `src/models` schema gains a field while the dev server is already running, Next.js Fast Refresh reloads the module but does **not** recompile the Mongoose model — the stale model keeps its old paths, and **strict mode silently strips the unknown field** from `findByIdAndUpdate`/`$set` writes. So the write "succeeds" while dropping the new field.

Rules when adding/renaming a field on any schema in `src/models/`:
- `src/models/index.ts` uses a `defineModel()` helper that recompiles models in development (drops the cached model via `mongoose.deleteModel` so Fast Refresh picks up schema edits). Register every model through it — never reintroduce the raw `models.X || model("X", schema)` pattern, or the field-stripping bug comes back.
- If writes to a newly added field still don't persist, **fully restart the dev server** (not just save-to-reload) so the model recompiles, then retry.
- When you add a field, verify it round-trips end-to-end (save → refetch shows the new value) before considering the feature done — don't trust a 200 alone.
- Also make sure the field is in the route's Zod/validation schema (an unlisted field is stripped at the API layer too) **and** returned by the GET route (no `.select()` that omits it).

## Project Rules & Boundaries

1. Enforce permissions server-side with `can()` / `getCapabilities()` from `src/lib/permissions.ts`. Never check a role name. UI hiding alone doesn't count — [docs/AGENTS.md](docs/AGENTS.md).
2. An expired trial/plan makes the workspace read-only for **every** role. New write routes and write UI must respect it — [ADR-002](docs/DECISIONS.md#adr-002-expired-trialplan--read-only-for-every-role).
3. Workspace membership grants every project. `project.members` holds **guests only**, so never copy members into it. To notify "the team", use workspace members plus guests.
4. Any write to `task.status` must also set `completedAt`/`startedAt`, log activity and notify watchers — [docs/api/tasks.md](docs/api/tasks.md#status-write-paths).
5. Mongoose models and `src/lib/{db,auth,permissions,apiHelpers}.ts` and `src/lib/firebase/admin.ts` are server-only. Never import them into a `"use client"` file.
6. Client data goes through RTK Query (`src/store/api.ts`) with optimistic patch + undo. Don't add SWR, fetch-in-useEffect or a second cache.
7. Validate every API body with Zod via `parseBody`, and return `{ error }` with a real status — [docs/12-api-guidelines.md](docs/12-api-guidelines.md).
8. Prices, limits and trial length live only in `src/lib/plans.ts`.
9. Statuses, task types and custom fields are per project (`ProjectSchema`). `epic`/`subtask` are system types.
10. Never read or print real values from `.env`. Document variable names only. `.env` is excluded from the Docker image.
11. Super admin is `SUPER_ADMIN_EMAIL` in `src/lib/constants.ts`, never a DB role.
12. One library per concern (Tailwind v4, lucide-react, recharts, @hello-pangea/dnd, zod, jose) — [docs/06-tech-stack.md](docs/06-tech-stack.md).

## Where Things Are

- `src/app/(app)/` — signed-in pages (dashboard, workspaces, admin, `p/[projectId]/*` views). `src/app/(auth)/` — login, register, forgot password.
- `src/app/api/` — route handlers, the only code that touches the DB.
- `src/app/page.tsx` — public landing and pricing page.
- `src/components/` — `AppShell`, `TaskModal`, shared primitives `src/components/ui.tsx`, `src/components/project/common.tsx`.
- `src/lib/` — auth, permissions, plans, constants, API helpers, db, firebase.
- `src/store/` — Redux store and RTK Query API. `src/models/index.ts` — all Mongoose schemas.
- `scripts/seed.mjs` — demo data. `Dockerfile`, `cloudbuild.yaml` — deploy.

## PR & Deployment Flow

- Default branch `master`. Branch per change, open a PR into `master` (or commit to `master` for small fixes). Only commit, push, merge or deploy when the user asks.
- Deploy: `master` → Cloud Run via `cloudbuild.yaml` / `gcloud run deploy`. There is no staging environment and no CI checks ([docs/20-deployment.md](docs/20-deployment.md)). Secrets are set as Cloud Run env vars, never in the image.

## Verification & Knowledge Maintenance

- Before editing, note the known failures: typecheck OOM, one lint error, no tests. Don't confuse these with regressions you caused.
- Gate before a PR: `npx eslint <touched files>` clean, `npm run lint` with no *new* errors, `npm run build` succeeds, then exercise the change in `npm run dev` as an owner and as a viewer. For data changes, confirm the value round-trips after a refetch.
- Every API call 500s locally? Read `.next/dev/logs/next-development.log` first. `querySrv EBADRESP` means the network's DNS is broken: set `MONGODB_DNS_SERVERS` ([docs/15-environment-setup.md](docs/15-environment-setup.md)).
- Update the doc that owns a fact (see [docs/README.md](docs/README.md)) in the same change. Record new direction in `docs/01-product-vision.md` + `docs/DECISIONS.md`, and new unknowns in `docs/OPEN_QUESTIONS.md`.
- Missing backend capability (payments, email, file storage)? Describe the contract and record the gap. Never ship a fake integration.
