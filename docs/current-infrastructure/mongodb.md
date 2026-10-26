---
covers: ["src/lib/db.ts", "src/models/index.ts", "scripts/seed.mjs"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# MongoDB

> The single datastore for every Kanbo entity, accessed only through Mongoose in `/api/**` handlers.

> [!WARNING]
> `Task.status`, `Task.type` and the keys/option ids inside `Task.customFields` are **string ids into the parent Project's config** (`statuses`, `taskTypes`, `customFields`), not DB references — Mongo will not stop a dangling id. Project access is **computed**: a workspace member reaches every project without a `Project.members` row (only guests live there). Resolve access with `src/lib/permissions.ts:getProjectRole`, never from `Project.members` alone.

## Role
Source of truth for users (profiles; credentials live in Firebase), workspaces (members, plan/trial state), projects, sprints, tasks, comments, invites, activity, notifications, saved filters and dashboards.

## Connection
- **Env var:** `MONGODB_URI` (default `mongodb://localhost:27017/sprint-management`) — see [../15-environment-setup.md](../15-environment-setup.md).
- **Client:** `src/lib/db.ts:dbConnect` — caches `{ conn, promise }` on `global.mongoose` so dev hot-reloads and concurrent route handlers share one connection. `bufferCommands: false` (queries fail fast instead of queueing before connect). A failed connect clears the cached promise so the next request retries.
- **Auth:** credentials in the connection string (Atlas user/password in prod).
- **Access posture:** read/write, one pooled connection per server instance. Every handler reaches it via `src/lib/apiHelpers.ts:withAuth` (which calls `dbConnect()`), or calls `dbConnect()` directly (`auth/login`, `auth/register`).

## Entities / Tables / Endpoints
Collection names are Mongoose's default pluralisation of the model names registered in `src/models/index.ts`.

| Name | Purpose |
|---|---|
| `users` | profile, `firebaseUid` link, display `role`, `active`; legacy `passwordHash` |
| `workspaces` | tenant: owner, members + role, plan / trial / expiry fields |
| `projects` | key prefix, statuses, task types, custom fields, guests, excluded members |
| `sprints` | iterations: `planned → active → completed → archived` |
| `tasks` | work items: `{project, key}` unique, text index on title/description/key |
| `comments` | task comments + mentions |
| `invites` | project invites (`pending/accepted/rejected`) |
| `activities` | audit log (index `createdAt: -1`) |
| `notifications` | in-app notifications per user |
| `savedfilters` | per-user saved filters |
| `dashboards` | per-user widget layouts |

## Schema / Shape
Field-level schemas and indexes: [../database/entities.md](../database/entities.md) (one home).

## Functions We Call
| Function | Returns | Used by |
|---|---|---|
| `dbConnect()` | cached `mongoose` | `withAuth()`, auth routes |
| `defineModel(name, schema)` | `Model` | `src/models/index.ts` only — dev recompiles to dodge stale-model field stripping (root `AGENTS.md`) |
| `find` / `findOne` / `findById` / `countDocuments` | docs | every GET route |
| `create` / `findByIdAndUpdate` / `updateMany` / `bulkWrite` | docs / write results | mutating routes |
| `deleteMany` / `findByIdAndDelete` | write results | cascades, e.g. `DELETE /api/workspaces/[id]` |

## Migrations & Seed
- **Migrations:** root-level `migration.js` or `migration.<YYYYMMDDHHMM>.js`, idempotent, with a rollback note (rules in root `AGENTS.md`; how to run in [../15-environment-setup.md](../15-environment-setup.md#migrations)). **None exist** at 5ec7e9c — not in the working tree, not in git history. Migrations are not run by the deploy pipeline. <!-- verify:ignore -->
- **Seed:** `scripts/seed.mjs` uses its own loose (`strict: false`) models, so it bypasses schema defaults (e.g. workspace `trialEndsAt`) and validation. Demo data caveats: [../15-environment-setup.md](../15-environment-setup.md#seed-data--demo-accounts).

## Degradation
If MongoDB is unreachable, `dbConnect()` throws. Most handlers don't catch it, so the request fails with a 500 from Next rather than a JSON `{ error }`; `auth/login` and `auth/register` call `dbConnect()` before their `try`, so they fail the same way. There is no mock fallback — the UI shows its error/empty states.

> [!WARNING]
> `DELETE /api/workspaces/[id]` deletes the workspace's projects, tasks and sprints, but not their comments, invites, activities, notifications or dashboard references — those are left orphaned.
