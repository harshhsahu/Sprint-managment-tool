# API — Tasks

> Handlers in [`src/app/api/tasks/**`](../../src/app/api/tasks). Powers the board, backlog,
> list, calendar, timeline, My Tasks, and the task modal.

## Purpose
CRUD + lifecycle for tasks, plus comments, duplicate, bulk update, and drag-and-drop reorder.

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/tasks` | GET | list with rich filters/sort/pagination |
| `/api/tasks` | POST | create a task (auto-assigns `KEY-n`) |
| `/api/tasks/[id]` | GET | full task + comments + activity + subtasks + `myCapabilities` |
| `/api/tasks/[id]` | PATCH | update fields / status / assignee / etc. |
| `/api/tasks/[id]` | DELETE | delete task (+ its subtasks & comments) |
| `/api/tasks/[id]/comments` | POST | add a comment (parses @mentions) |
| `/api/tasks/[id]/duplicate` | POST | duplicate a task |
| `/api/tasks/bulk` | PATCH | bulk-update a set of tasks |
| `/api/tasks/reorder` | POST | persist drag-and-drop order/status/sprint |

Capabilities enforced: `task:create` (POST, duplicate), `task:edit` (PATCH, bulk, reorder),
`task:delete` (DELETE), `task:comment` (comments), `project:view` (GET).

---

## GET /api/tasks
### Query Parameters
| Param | Type | Description |
|---|---|---|
| `project` | id | scope to one project (else: all projects the user can see) |
| `sprint` | id\|`none`\|csv | sprint filter (`none` = backlog) |
| `status`,`priority`,`type`,`label` | csv | multi-value filters |
| `assignee` | `me`\|`none`\|csv | assignee filter |
| `reporter` | `me`\|csv | reporter filter |
| `epic`,`parentTask` | id | relation filters |
| `q` | string | text match on title/key/description |
| `dueBefore`,`dueAfter` | ISO date | due-date range |
| `points` | csv | story-point filter |
| `archived` | `1` | show archived |
| `sort` | string | `order` \| `-createdAt` \| `dueDate` \| `priority` \| … |
| `page`,`limit` | number | pagination (limit ≤ 200) |

### Response — 200
```ts
{ tasks: Task[]; total: number; page: number; pages: number }
```

## POST /api/tasks
### Body (zod)
`{ project, title, description?, type?, status?, priority?, assignee?, sprint?, epic?, parentTask?, storyPoints?, labels?, dueDate? }`
### Behavior
- Increments `project.taskCounter`; sets `key = <project.key>-<counter>`.
- Places at end of its column (`order = maxOrder + 1000`); reporter = current user, who also becomes a watcher.
- Notifies the assignee (if any) and writes a `task.created` activity.

## PATCH /api/tasks/[id]
- Diffs each field; on status change into a `done` category sets `completedAt`, into
  `in_progress` sets `startedAt`, and notifies watchers. Assignee change notifies + auto-watches.
- Returns the repopulated `{ task }`.

## POST /api/tasks/reorder
### Body `{ project, updates: [{ id, order, status?, sprint? }] }`
- Persists new fractional `order` (and column/sprint) via `bulkWrite`. Status-change
  side-effects (timestamps, notifications) still go through PATCH from the client.

### Behavior Notes
- Cross-project GET (no `project`) is scoped to the user's visible projects (isolation).
- All item routes 404 if the task is outside the user's access.
