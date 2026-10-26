---
covers: ["src/app/api/tasks/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Tasks

> Handlers in `src/app/api/tasks/`. Powers the board, backlog, list, calendar, timeline,
> My Tasks (`assignee=me` / `reporter=me`), the reports Done calendar, and the task modal.

## Purpose
CRUD + lifecycle for tasks, plus comments, duplicate, bulk update, and drag-and-drop reorder.
Every handler starts with `src/lib/apiHelpers.ts:withAuth` (401 if no session) and validates
bodies with zod via `parseBody` (422 `"<path>: <msg>; …"`, 400 on invalid JSON). Error
envelope: `{ error: string }`.

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/tasks` | GET | list with filters/sort/pagination (any project role) |
| `/api/tasks` | POST | create a task (auto-assigns `KEY-n`) — `task:create` |
| `/api/tasks/[id]` | GET | task + comments + activity + subtasks + `myRole` + `myCapabilities` + `readOnly` |
| `/api/tasks/[id]` | PATCH | update fields / status / assignee / … — `task:edit` |
| `/api/tasks/[id]` | DELETE | hard-delete task, its subtasks and comments — `task:delete` |
| `/api/tasks/[id]/comments` | POST | add a comment (parses @mentions) — `task:comment` |
| `/api/tasks/[id]/duplicate` | POST | duplicate a task — `task:create` |
| `/api/tasks/bulk` | PATCH | bulk-update up to 200 tasks — `task:edit` on every affected project |
| `/api/tasks/reorder` | POST | persist drag-and-drop order/status/sprint — `task:edit` |

Capabilities resolve through `src/lib/permissions.ts:can` / `getCapabilities`. When the
workspace trial/plan is expired every role is reduced to `project:view`, so every write here
returns 403 with the route's own message (e.g. "You don't have permission to edit tasks").
Roles → capabilities: [../modules/04-roles-permissions.md](../modules/04-roles-permissions.md).

---

## GET /api/tasks

### Purpose
Filtered task list for one project, or across every project the user can see.

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `project` | id | scope to one project (403 if no role). Omitted → all projects in the user's workspaces + projects they guest on |
| `sprint` | id csv \| `none` | `none` = backlog (`sprint: null`). The handler comment also lists `active`, but it is **not implemented** — `active` is treated as an id and fails the ObjectId cast |
| `status`, `priority`, `type` | csv | `$in` filters |
| `cf_<fieldId>` | csv | multiselect custom-field filter: matches if the stored array contains any option |
| `assignee` | `me` \| `none` \| csv | |
| `reporter` | `me` \| csv | |
| `epic`, `parentTask` | id | relation filters |
| `q` | string | case-insensitive regex on title/key/description (input is **not escaped**) |
| `dueBefore`, `dueAfter` | ISO date | inclusive due-date range |
| `completedBefore`, `completedAfter` | ISO date | `completedAt` range — drives the reports Done calendar; only done tasks have `completedAt` |
| `points` | csv numbers | story-point filter |
| `archived` | `1` | return archived tasks **instead of** active ones (filter is `archived: <bool>`) |
| `sort` | string | passed straight to Mongoose `.sort()` (default `order`; UI uses `order`, `-createdAt`, `createdAt`, `dueDate`, column ids) |
| `page`, `limit` | number | default `1` / `100`; `limit` clamped to 1–200 |

### Response — 200
```ts
{
  tasks: Task[];   // assignee/reporter populated (name,email,avatarColor); sprint (name,status); epic (title,key)
  total: number;
  page: number;
  pages: number;
}
```

## POST /api/tasks
### Body (zod `createSchema`)
```ts
{
  project: string; title: string /*1–300*/; description?: string /*≤50000*/;
  type?: string /*default "task"*/; status?: string; priority?: "highest"|"high"|"medium"|"low"|"lowest";
  assignee?: string|null; sprint?: string|null; epic?: string|null; parentTask?: string|null;
  storyPoints?: number|null /*0–100*/; dueDate?: string|null; customFields?: Record<string, unknown>;
}
```
### Behavior
- 403 without `task:create`; `$inc` `project.taskCounter` (404 if project missing), then
  `key = <project.key>-<counter>`.
- `type` must exist in `project.taskTypes` (or `DEFAULT_TASK_TYPES` if empty) → else 422.
- `status` defaults to the first project status; **not validated** against the project.
- `order = max(order in that status) + 1000`; reporter = current user and sole initial watcher.
- Logs `task.created`; notifies the assignee (`assignment`).
- Does **not** set `completedAt`/`startedAt`, even when created directly into a done or
  in-progress column (board QuickCreate does this).
- Returns `201 { task }` (assignee/reporter populated).

## GET /api/tasks/[id]
- 404 unknown id, 403 no project role.
- Response: `{ task, comments, activity /*latest 50*/, subtasks /*non-archived, by order*/, myRole, myCapabilities: string[], readOnly: boolean }`.
  `task` populates assignee/reporter (incl. `designation`), sprint, epic, parentTask,
  watchers, dependencies.

## PATCH /api/tasks/[id]
### Body (zod `patchSchema`, all optional)
`title, description, type, status, priority, assignee, sprint, epic, storyPoints, dueDate, customFields, watchers[], dependencies[], archived, order`
(`parentTask` is not patchable.)
### Behavior
- 404 / 403 (`task:edit`) are checked **before** body validation.
- `type` change → 422 if not a project type.
- `status` change → 422 if not a project status; sets `completedAt` on entering a `done`
  category (if unset), clears it on leaving `done`, sets `startedAt` on first `in_progress`;
  notifies every watcher (`status_change`, actor skipped by `notify`).
- `assignee` change → notifies the new assignee and adds them to `watchers`.
- `customFields` is **merged** into the existing object + `markModified` (Mixed type).
- One `task.updated` activity listing the changes (order/watchers changes are silent).
- Returns `{ task }` (assignee, reporter, sprint, epic populated).

## DELETE /api/tasks/[id]
Hard delete: removes subtasks (`parentTask`), comments, pulls the id from other tasks'
`dependencies`, deletes the task, logs `task.deleted`. Subtask comments and the task's
activity rows are not removed. Returns `{ ok: true }`.

## POST /api/tasks/[id]/comments
- Body `{ body: string /*1–10000*/ }`; 403 without `task:comment`.
- Mentions: `@[Name](<24-hex id>)` tokens (what the modal composer emits) and plain
  `@email` (resolved via `User`). Each mentioned user gets a `mention` notification; other
  watchers get `comment`. Logs `task.commented`. Returns `201 { comment }`.
- No edit/delete comment routes exist.

## POST /api/tasks/[id]/duplicate
New key from the counter; copies title (+ " (copy)"), description, type, status, priority,
assignee, sprint, epic, storyPoints, customFields, dueDate; `order = src.order + 1`;
reporter/watchers = current user. **Not copied:** `parentTask` (a duplicated subtask becomes
top-level), dependencies, `completedAt`/`startedAt`. Logs `task.duplicated`. `201 { task }`.

## PATCH /api/tasks/bulk
### Body
```ts
{ taskIds: string[] /*1–200*/; set: { status?, priority?, assignee?, sprint?, storyPoints?, archived?, dueDate? } }
```
- Loads the tasks, checks `task:edit` on each distinct project (403 if any fails).
- **status or sprint in `set`:** per-task `bulkWrite` with the same completedAt/startedAt rules
  as PATCH, a per-task `task.updated` activity, and watcher notifications on status change.
  Unknown status ids are still written (no 422).
- **otherwise:** one `updateMany` + one `task.bulk_updated` activity per project (`meta` = `set`);
  no assignment notifications.
- Returns `{ ok: true, modified: number }`.

## POST /api/tasks/reorder
### Body
```ts
{ project: string; updates: { id: string; order: number; status?: string; sprint?: string|null }[] /*1–500*/ }
```
- 403 without `task:edit` on `project`; every `updateOne` is filtered by `{ _id, project }`.
- Reads current docs only for updates that carry `status`/`sprint`. On a real status change
  applies the completedAt/startedAt rules, logs `task.updated` ("status: A → B"), notifies
  watchers; on a sprint change logs "moved to sprint"/"moved to backlog". Side-effects run
  after the `bulkWrite`.
- An unknown status id is written without side-effects (no 422, unlike PATCH).
- Returns `{ ok: true }`. Client mutation `reorderTasks` does not invalidate tags.

---

## Status write paths
Task status can change through three task routes. Each **must** set/clear `completedAt`,
set `startedAt`, log activity and notify watchers — reports (Done calendar, velocity) depend
on `completedAt`.

| Path | Used by | completedAt / startedAt | Activity | Notify watchers | Validates status |
|---|---|---|---|---|---|
| `PATCH /api/tasks/[id]` | modal, list inline, subtask select | yes | yes | yes | yes (422) |
| `POST /api/tasks/reorder` | board drag, backlog drag | yes (since `5ec7e9c`) | yes | yes | no |
| `PATCH /api/tasks/bulk` | BulkBar | yes (since `5ec7e9c`) | yes (per task) | yes | no |

The board calls reorder **then** PATCH for a cross-column drop
(`src/app/(app)/p/[projectId]/board/page.tsx:BoardPage`). Before `5ec7e9c`, reorder wrote the
raw status, so the follow-up PATCH saw no diff and all three side-effects were lost for board
moves. Today reorder owns them and the PATCH is a no-op.

Other places that move status **without** these side-effects:
- `POST /api/tasks` (create directly into a done column → no `completedAt`).
- `POST /api/tasks/[id]/duplicate` (copies status, not `completedAt`).
- `PATCH /api/projects/[id]` with `statuses`: tasks in a removed status are remapped to the
  first status with a raw `updateMany` (no `completedAt` clear, no activity).

When adding a new write path, copy the block from `src/app/api/tasks/[id]/route.ts:PATCH`.

### Behavior Notes
- Cross-project GET (no `project`) is scoped to the user's workspaces + guest projects.
- Item routes return 404 for an unknown id and 403 (not 404) when the user lacks access.
- `notify` never notifies the actor; `logActivity`/`notify` swallow their own errors.
- `TaskSchema` has a text index that this route does not use (`q` is a regex scan).

### Example
```json
{ "project": "665f0c…", "updates": [{ "id": "6660a1…", "order": 1500, "status": "done" }] }
```
