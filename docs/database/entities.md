---
covers: ["src/models/**", "src/lib/db.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Database — Entities

All entities live in one MongoDB database, defined as Mongoose schemas in
`src/models/index.ts`. Every schema has `timestamps: true` (`createdAt`, `updatedAt`) unless noted.

**Connection:** `MONGODB_URI` → `src/lib/db.ts:dbConnect` (connection cached on `global.mongoose`; falls back to a localhost URI when unset; optional `MONGODB_DNS_SERVERS` for SRV lookups — see [15-environment-setup.md](../15-environment-setup.md))
**Access posture:** read/write, single shared connection, mediated by `src/app/api/**` (no direct client access)

---

## Model registration — `defineModel()`
Every model is registered through `src/models/index.ts:defineModel`:
```ts
if (process.env.NODE_ENV !== "production" && models[name]) mongoose.deleteModel(name);
return models[name] || model(name, schema);
```
In development the cached model is dropped and recompiled on each module load, so Fast Refresh picks up schema edits. Production keeps the cache (avoids `OverwriteModelError`).

> [!WARNING]
> Never reintroduce `models.X || model("X", schema)` directly. A stale compiled model keeps its old paths and **strict mode silently strips** new fields from `$set` writes — the PATCH returns 200 but nothing persists. If a new field still doesn't save, fully restart `next dev`, and check the route's Zod schema and GET projection too (root `AGENTS.md`).

---

## Entity: `User`
**Role:** an account/person. Identity is owned by Firebase Auth.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `name` | string | required, trimmed |
| `email` | string | required, **unique**, lowercased, trimmed, indexed |
| `firebaseUid` | string | indexed, sparse — links to the Firebase user |
| `passwordHash` | string | optional legacy bcrypt hash, kept for Firebase import; excluded from API responses |
| `role` | enum | `super_admin` \| `member` (default). Display/back-compat only — authorization uses `SUPER_ADMIN_EMAIL` ([modules/08-super-admin.md](../modules/08-super-admin.md)) |
| `designation`, `timezone` (default `UTC`), `avatarColor` | string | profile |
| `active` | bool | default true; `false` → every API call returns 401 (`src/lib/auth.ts:requireUser`) |

## Entity: `Workspace`
**Role:** tenant + billing unit; container for projects.

| Field | Type | Notes |
|---|---|---|
| `name` | string | required, trimmed |
| `description` | string | default `""` |
| `owner` | ObjectId→User | required; the creator; can't be demoted/removed |
| `members[]` | `{ user: ObjectId→User, role }` (no `_id`) | role enum `owner` \| `admin` \| `editor` (default) \| `viewer`. Applies to **every project** in the workspace. Owner is also stored here with role `owner`. |
| `plan` | enum | `trial` \| `pro` (default) \| `business` \| `enterprise` — see [modules/07-billing-plans.md](../modules/07-billing-plans.md) |
| `subscriptionStatus` | enum | `trialing` (default) \| `active` \| `expired` — stored; effective status is derived by `resolveStatus` |
| `trialEndsAt` | Date | default `now + 15 days` (hard-coded, not `TRIAL_DAYS`) |
| `planExpiresAt` | Date \| null | default null = paid plan never lapses |

> [!NOTE]
> Workspaces created before `22ff6f3` have no plan fields unless backfilled; they resolve to `trialing` forever (never read-only).

## Entity: `Project`
**Role:** a board/backlog under a workspace, with its own workflow and field config.

| Field | Type | Notes |
|---|---|---|
| `workspace` | ObjectId→Workspace | required, indexed |
| `name` | string | required, trimmed |
| `key` | string (uppercase) | required; **task-key prefix**, e.g. `CC` → `CC-1`; unique per workspace |
| `description` | string | default `""` |
| `lead` | ObjectId→User | creator by default; reset to workspace owner if the lead leaves the workspace |
| `members[]` | `{ user, role }` (no `_id`) | **GUESTS only** — users NOT in the workspace. role `admin` \| `editor` (default) \| `viewer`. |
| `excludedMembers[]` | ObjectId→User | workspace members removed from **this** project only (revertable) |
| `statuses[]` | `{ id, name, color, category, order, wipLimit }` | category ∈ `todo`/`in_progress`/`done`; `wipLimit` 0 = none. Seeded from `DEFAULT_STATUSES`. |
| `taskTypes[]` | `{ id, name, color, icon, system }` | per-project task types; seeded from `DEFAULT_TASK_TYPES`; `system: true` for `epic`/`subtask` |
| `hiddenFields[]` | string | ids from `OPTIONAL_TASK_FIELDS` hidden on tasks |
| `requiredFields[]` | string | ids from `REQUIRABLE_TASK_FIELDS` — soft-required on create |
| `customFields[]` | `{ id, name, type, options? }` | type `text`\|`number`\|`date`\|`multiselect`; `options[]` = `{ id, name, color }` (multiselect only). New projects get a `labels` multiselect. |
| `taskCounter` | number | monotonic counter for task numbering |
| `archived` | bool | archived projects are excluded from `GET /api/projects` |

Indexes: `{ workspace: 1, key: 1 }` unique; `workspace`.

> [!NOTE]
> `Project.labels[]` and `Task.labels[]` were removed in `f44a142` (2026-07-28); labels are now the `labels` multiselect custom field. No migration of old label data exists in the repo.

## Entity: `Sprint`
**Role:** a time-boxed iteration in a project.

| Field | Type | Notes |
|---|---|---|
| `project` | ObjectId→Project | required, indexed |
| `name`, `goal` | string | `name` required |
| `status` | enum | `planned` (default) \| `active` \| `completed` \| `archived` |
| `startDate`, `endDate`, `completedAt` | Date | |
| `capacity` | number | story points the team can take (default 0) |
| `committedPoints`, `completedPoints` | number | snapshot metrics captured on completion |

## Entity: `Task`
**Role:** the unit of work.

| Field | Type | Notes |
|---|---|---|
| `project` | ObjectId→Project | required, indexed |
| `key` | string | required, indexed; `<PROJECT.key>-<n>`, unique per project |
| `title` | string | required, trimmed |
| `description` | string | rich text (HTML) |
| `type` | string | default `task`; a `project.taskTypes[].id` — **no schema enum**, validated in the API |
| `status` | string | default `backlog`, indexed; a `project.statuses[].id` |
| `priority` | enum | `highest` \| `high` \| `medium` (default) \| `low` \| `lowest`; indexed |
| `assignee` | ObjectId→User \| null | indexed |
| `reporter` | ObjectId→User | required |
| `sprint` | ObjectId→Sprint \| null | indexed; null = backlog |
| `epic` | ObjectId→Task \| null | parent epic |
| `parentTask` | ObjectId→Task \| null | for subtasks |
| `storyPoints` | number \| null | |
| `dueDate` | Date \| null | |
| `customFields` | Mixed | `{ [fieldId]: value }` per `project.customFields` (multiselect → option id array) |
| `watchers[]` | ObjectId→User | notified on changes |
| `dependencies[]` | ObjectId→Task | "blocked by" |
| `order` | number | position within status column / backlog |
| `archived` | bool | indexed |
| `startedAt`, `completedAt` | Date \| null | stamped on entering in_progress / done categories |
| `attachments[]` | `{ name, url, size, uploadedBy, uploadedAt }` | field present; no upload route exists |

Indexes: `{ project: 1, key: 1 }` unique; text index on `title`/`description`/`key`; single-field `project`, `key`, `status`, `priority`, `assignee`, `sprint`, `archived`. Task contracts: [api/tasks.md](../api/tasks.md).

## Entity: `Comment`
| Field | Type | Notes |
|---|---|---|
| `task` | ObjectId→Task | required, indexed |
| `author` | ObjectId→User | required |
| `body` | string | required |
| `mentions[]` | ObjectId→User | parsed from `@[Name](<24-hex id>)` tokens or plain `@email` <!-- verify:ignore --> |

## Entity: `Activity`
Audit log. `{ project?, workspace?, task?, sprint?, user (required), action (required, e.g. task.created, workspace.plan_changed), detail, meta (Mixed) }`.
Indexes: `project`, `workspace`, `task`; `{ createdAt: -1 }`. Written via `src/lib/apiHelpers.ts:logActivity` (errors swallowed).

## Entity: `Notification`
`{ user (required, indexed), type, title (required), body, link, read (indexed), actor }`.
`type` enum: `assignment` \| `mention` \| `comment` \| `status_change` \| `sprint` \| `due_date` \| `invite`. Written via `src/lib/apiHelpers.ts:notify` (skips self-notifications).

## Entity: `SavedFilter`
`{ user (required, indexed), project (ObjectId \| null), name (required), filters (Mixed) }` — persisted list/board filter sets.

## Entity: `Invite`
**Role:** pending invitation to join a single project as a guest; addressed by email so non-users can be invited.

| Field | Type | Notes |
|---|---|---|
| `project` | ObjectId→Project | required, indexed |
| `email` | string | required, lowercased, trimmed, indexed |
| `role` | enum | `admin` \| `editor` (default) \| `viewer` |
| `status` | enum | `pending` (default) \| `accepted` \| `rejected`; indexed |
| `invitedBy` | ObjectId→User | required |
| `respondedAt` | Date \| null | |

One row per project+email in practice: re-inviting reuses the resolved row (not a unique index). Contracts: [api/projects.md](../api/projects.md), [api/workspaces.md](../api/workspaces.md).

## Entity: `Dashboard`
| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId→User | required, indexed |
| `name` | string | required |
| `isDefault` | bool | |
| `filters` | sub-schema (no `_id`) | `{ projects[], assignees[] (ids or "unassigned"), lead, range (30d\|90d\|6m\|12m), priority[], type[] }` |
| `widgets[]` | sub-schema (no `_id`) | `{ id, type, w (1–2), project, chartType, range, projects[], assignees[] }` |

> [!WARNING]
> `filters` must stay an explicit `new Schema(...)`: as a plain object, its `type` sub-field collides with Mongoose's reserved `type` key and the whole field is cast as `[String]`.

---

## Cross-System References
There is a **single database**, so most references are real ObjectId links (no FK enforcement, no cascades). Logical (non-ObjectId) references:
- `Task.status` → `Project.statuses[].id`; `Task.type` → `Project.taskTypes[].id`; keys of `Task.customFields` → `Project.customFields[].id`, multiselect values → `options[].id`. Removing a status remaps tasks to the first status; removing a task type in use is rejected; removing a custom field/option leaves stale values.
- `Project.hiddenFields` / `requiredFields` → ids in `src/lib/constants.ts` (`OPTIONAL_TASK_FIELDS`, `REQUIRABLE_TASK_FIELDS`).
- `Invite.email` → `User.email` (matched at read time, the user may not exist yet).
- A user's project access is **computed**, not stored: a `Workspace.members` entry applies to every project unless the user is in that project's `excludedMembers`. `Project.members` only holds guests.
- Deletes are manual cascades in route handlers: workspace delete removes projects/tasks/sprints; project delete removes tasks/sprints; comments, activity, invites, saved filters and notifications are left orphaned.

---

## Migrations
> [!TODO]
> Root `AGENTS.md` requires a root `migration*.js` for any data-shape change, and code comments reference a migration that back-filled `Project.taskTypes`, synced `User.role` and imported passwords into Firebase. No `migration*.js` exists in the working tree or git history at `5ec7e9c`; only `scripts/seed.mjs` is present. Needs a human to locate or recommit them. <!-- verify:ignore -->
