# Database — Entities

All entities live in one MongoDB database, defined as Mongoose schemas in
[`src/models/index.ts`](../../src/models/index.ts).

**Connection:** `MONGODB_URI` → `src/lib/db.ts` (cached connection)
**Access posture:** read/write, single shared connection, mediated by `src/app/api/**`

---

## Entity: `User`
**Role:** an account/person.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | PK |
| `name`, `email` | string | `email` unique, lowercased, indexed |
| `passwordHash` | string | bcrypt; never returned to client |
| `role` | enum | `super_admin` \| `member` (global) |
| `designation`, `timezone`, `avatarColor` | string | profile |
| `active` | bool | deactivated users can't log in |

## Entity: `Workspace`
**Role:** top-level container for teams/projects.

| Field | Type | Notes |
|---|---|---|
| `owner` | ObjectId→User | creator; always workspace admin |
| `members[]` | `{ user, role }` | role: `workspace_admin` \| `member` |
| `customRoles[]` | `{ id, name, capabilities[] }` | reusable project roles for this workspace |

## Entity: `Project`
**Role:** a board/backlog under a workspace.

| Field | Type | Notes |
|---|---|---|
| `workspace` | ObjectId→Workspace | indexed |
| `key` | string (uppercase) | **task-key prefix**, e.g. `CC` → `CC-1`; unique per workspace |
| `taskCounter` | number | monotonic counter for task numbering |
| `lead` | ObjectId→User | implicit `project_admin` |
| `members[]` | `{ user, role }` | role = built-in id **or** a workspace custom-role id |
| `statuses[]` | `{ id, name, color, category, order, wipLimit }` | workflow columns; category ∈ todo/in_progress/done |
| `labels[]` | `{ id, name, color }` | project labels |
| `archived` | bool | |

Unique index: `{ workspace, key }`.

## Entity: `Sprint`
**Role:** a time-boxed iteration in a project.

| Field | Type | Notes |
|---|---|---|
| `project` | ObjectId→Project | indexed |
| `name`, `goal` | string | |
| `status` | enum | `planned` \| `active` \| `completed` \| `archived` |
| `startDate`, `endDate`, `completedAt` | Date | |
| `capacity` | number | story points the team can take |
| `committedPoints`, `completedPoints` | number | snapshotted on start/complete |

## Entity: `Task`
**Role:** the unit of work.

| Field | Type | Notes |
|---|---|---|
| `project` | ObjectId→Project | indexed |
| `key` | string | `<PROJECT.key>-<n>`, e.g. `CC-42`; unique per project |
| `title`, `description` | string | description is plain text (V1) |
| `type` | enum | epic \| story \| task \| bug \| spike \| improvement \| subtask |
| `status` | string | a `project.statuses[].id` |
| `priority` | enum | highest \| high \| medium \| low \| lowest |
| `assignee`, `reporter` | ObjectId→User | |
| `sprint` | ObjectId→Sprint \| null | null = backlog |
| `epic` | ObjectId→Task \| null | parent epic |
| `parentTask` | ObjectId→Task \| null | for subtasks |
| `storyPoints` | number \| null | |
| `labels[]` | string[] | `project.labels[].id` values |
| `dueDate` | Date \| null | |
| `watchers[]` | ObjectId→User | notified on changes |
| `dependencies[]` | ObjectId→Task | "blocked by" |
| `order` | number | fractional ordering within column/backlog |
| `archived` | bool | |
| `startedAt`, `completedAt` | Date | set on entering in_progress/done categories |
| `attachments[]` | `{ name, url, size, uploadedBy, uploadedAt }` | field present; upload UI is roadmap |

Indexes: `{ project, key }` unique; `project`, `status`, `priority`, `assignee`, `sprint`,
`archived`; text index on `title/description/key`.

## Entity: `Comment`
`{ task, author, body, mentions[] }` — mentions parsed from `@[Name](userId)` or `@email`.

## Entity: `Activity`
Audit log: `{ project?, workspace?, task?, sprint?, user, action, detail, meta }`, sorted by `createdAt`.

## Entity: `Notification`
`{ user, type, title, body, link, read, actor }` — in-app notifications.

## Entity: `SavedFilter`
`{ user, project?, name, filters }` — persisted list/board filter sets.

## Entity: `Dashboard`
`{ user, name, isDefault, widgets[] }` — widget: `{ id, type, w, project? }`.

---

## Cross-System References
There is a **single database**, so most references are real ObjectId links. Note the
**logical (non-foreign-key) references**:
- `Task.labels[]` and `Task.status` are **string ids** pointing into the parent
  `Project.labels[].id` / `Project.statuses[].id` — not DB references. If a status/label is
  removed in project settings, tasks are remapped in the API layer (status → first column).
- `Project.members[].role` may be a **workspace custom-role id** (from
  `Workspace.customRoles[].id`), resolved to capabilities at request time — not a DB join.
