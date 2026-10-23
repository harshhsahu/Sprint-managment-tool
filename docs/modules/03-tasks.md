---
covers: ["src/app/api/tasks/**", "src/components/TaskModal.tsx", "src/components/project/common.tsx", "src/lib/constants.ts", "src/components/ui.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Tasks (and the Project Key)

> The core work-item model, its per-project configuration, and its human-readable identifier.

## Purpose
Represent every unit of work (epic → story/task/bug/spike/improvement/custom types → subtask)
and give each one a short, stable, human-readable identifier — the **task key** (e.g. `CC-42`).

---

## Why the project "key" exists

When you create a project you must choose a short **key** (2–8 letters, e.g. `CC` for
"Cloud Console"). It is the prefix for every task id in that project. It exists because:

1. **Human-readable, stable IDs.** MongoDB `_id`s (`652f…a1b`) are unusable in
   conversation. `CC-42` is short, memorable, and speakable ("can you look at CC-42?").
2. **Numbering.** Each project has a `taskCounter`; creating a task increments it
   (atomic `$inc` in `POST /api/tasks` and `POST /api/tasks/[id]/duplicate`) and sets
   `key = <PROJECT_KEY>-<counter>` (`CC-1`, `CC-2`, …). The counter only goes up — deleting
   `CC-2` does not renumber `CC-3`, so keys are permanent references.
3. **Cross-tool references.** Keys are meant to appear in Git branches/commits/PRs
   ("`fix: handle null IP (CC-13)`"), chat, and docs — a durable link back to the task.
4. **Namespacing per project.** Two projects can each have a `#42`; the prefix
   disambiguates (`CC-42` vs `API-42`). The key is **unique within a workspace**
   (`{ workspace, key }` unique index) so prefixes don't collide.
5. **Title-independent identity.** The task's title can change freely; its key never does,
   so links and references never break.

**Where it lives:** `Project.key` (uppercase) + `Project.taskCounter`; `Task.key` with a
unique `{ project, key }` index. See [../database/entities.md](../database/entities.md).

---

## Business Value
Fast, unambiguous reference to any piece of work across the board, the backlog, search,
notifications, Git history, and standups.

## Navigation Flow
1. Open any project view (board/backlog/list/calendar/timeline), My Tasks, the dashboard, or
   global search.
2. Click a card/row → the **task modal** opens. Shareable URL form:
   `/p/<projectId>/board?task=<taskId>` (only the board page reads `?task=`).
3. Edit inline; jump to related items (parent ↔ subtasks inside the same modal, with Back).

## Screens
### Task modal (`src/components/TaskModal.tsx`)
Title, description (plain `textarea`), subtasks, "Blocked by" dependencies, comments with
@mention chips, activity tab, and a right-hand field column (status, assignee, reporter, type,
priority, sprint, epic, points, due date, custom fields, watchers). Header has a **Copy link**
button. Props/behaviour detail: [../ui/task-modal.md](../ui/task-modal.md).

## Task Types (per project)
Types are configured **per project** in `Project.taskTypes` (`TaskTypeConfig`: `id`, `name`,
`color`, `icon`, `system?`) — no longer a global enum (`97f2931`).

| Piece | Where |
|---|---|
| Defaults seeded into new projects / fallback for unmigrated projects | `src/lib/constants.ts:DEFAULT_TASK_TYPES` (epic, story, task, bug, spike, improvement, subtask) |
| Structural types that can be recolored but never removed | `src/lib/constants.ts:SYSTEM_TASK_TYPE_IDS` (`epic`, `subtask`) |
| Resolve a type id → display config (project → defaults → neutral badge) | `src/lib/constants.ts:resolveTaskType` |
| Icon picker allow-list | `src/lib/constants.ts:CURATED_TYPE_ICONS` |
| Icon name → lucide component | `src/components/ui.tsx:TYPE_ICON_REGISTRY` (unknown name falls back to `CheckSquare`) |
| Badge renderer | `src/components/ui.tsx:TypeIcon` (pass `types={project.taskTypes}`; omit in cross-project views) |
| Editor | Settings page → Task types (`project:manage`), saved via `PATCH /api/projects/[id]` |
| Server validation of a task's `type` | `POST /api/tasks` and `PATCH /api/tasks/[id]` → 422 if not in the project's types |

Rules:
- Adding an icon means editing **both** `CURATED_TYPE_ICONS` and `TYPE_ICON_REGISTRY`, or the
  picker offers an icon that renders as `CheckSquare`.
- Removing a type that tasks still use is rejected by `PATCH /api/projects/[id]` with the count
  ("Reassign them first"); system types and duplicate ids are rejected too.
- `epic` tasks are containers referenced by `Task.epic`; `subtask` tasks have `parentTask` and
  are created from the modal's "Add a subtask" box (inherit the parent's sprint). The type
  picker hides `subtask` unless the task already is one.

## Task field configuration
| Setting (on `Project`) | Effect |
|---|---|
| `hiddenFields` | hides optional built-ins in the modal (`OPTIONAL_TASK_FIELDS`: sprint, epic, storyPoints, dueDate, dependencies, watchers) |
| `requiredFields` | soft-required nudge (below) — never enforced by the API |
| `customFields` | extra fields of type `text` / `number` / `date` / `multiselect` (`CUSTOM_FIELD_TYPES`) |

### Required fields nudge
`REQUIRABLE_TASK_FIELDS` (description, assignee, priority, dueDate, storyPoints, epic,
sprint). When a project has any `requiredFields`, quick-add on board and list opens the new
task's modal immediately, and the modal shows an amber "Please fill in: …  You can still save
without them." banner (`isFieldEmpty`). Nothing blocks saving — by design.

### Custom fields
- Values live in `Task.customFields` (Mongoose `Mixed`, `{ [fieldId]: value }`). The PATCH
  route **merges** the incoming object and calls `markModified("customFields")` — without that
  Mongoose would not persist the change.
- Multiselect values are arrays of option ids. "+ Option" in the modal calls
  `POST /api/projects/[id]/field-options` (`task:edit`), then patches the task and invalidates
  the `Project` tag so filters see the new option.
- Board/list/backlog/calendar `FilterBar` adds one filter per multiselect field →
  `cf_<fieldId>=optA,optB` on `GET /api/tasks`.
- Labels used to be a dedicated `labels` route/field; they became a multiselect custom field
  in `f44a142`. There is no `labels` field on `Task` any more.

## Bulk actions
`src/components/project/common.tsx:BulkBar` appears on board, backlog and list when ≥1 task is
selected **and** the user has `task:edit`. Actions: Status, Priority, Assign (incl. Unassigned),
Sprint (Backlog or any non-completed sprint), Archive. Each change is one
`PATCH /api/tasks/bulk`; errors `alert`, success refetches and clears the selection. No bulk
delete.

## Drag & drop (optimistic)
Board columns and backlog sections use `@hello-pangea/dnd`. The page patches its own
`getTasks` cache entry first, then calls `POST /api/tasks/reorder`; on failure
`patch.undo()`. The board additionally PATCHes status — see
[01-kanban-board.md](01-kanban-board.md#drag-write-sequence-gotcha) and
[../api/tasks.md](../api/tasks.md#status-write-paths).

## Read-only gating (capabilities)
UI reads `myCapabilities` from `GET /api/projects/[id]` (`src/components/project/common.tsx:useProject`)
and from `GET /api/tasks/[id]` (the modal). When the workspace trial/plan has lapsed,
`src/lib/permissions.ts:getCapabilities` collapses every role to `["project:view"]`, so the
same checks that hide controls from viewers hide them from everyone.

| Capability | Gates in the UI |
|---|---|
| `task:create` | board QuickCreate, list quick add (modal "Add subtask" and "Duplicate" are gated on `task:edit` instead, while the server checks `task:create`) |
| `task:edit` | drag (`isDragDisabled`), BulkBar, list inline selects, every modal input, Archive |
| `task:delete` | modal Delete |
| `task:comment` | comment composer; otherwise a "view-only" or "trial/plan has expired" note (`readOnly` from the task GET) |

`ProjectHeader` shows the red read-only banner when `readOnly` is true. The server re-checks
every write through `src/lib/permissions.ts:can`; task/sprint routes return their generic 403
("You don't have permission to …"), not `READ_ONLY_MESSAGE`.

## Data Dependencies
- **MongoDB:** `Task` (+ `Comment`, `Activity`, `Notification`), parent `Project`
  (statuses/taskTypes/customFields/key/counter).

## API Dependencies
- `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/[id]`,
  `POST /api/tasks/[id]/comments`, `POST /api/tasks/[id]/duplicate`, `PATCH /api/tasks/bulk`,
  `POST /api/tasks/reorder`. See [../api/tasks.md](../api/tasks.md).

## State Management
- **Server state:** RTK Query (`src/store/api.ts`). `getTask` is keyed by id and tagged
  `{type:"Task", id}`; `updateTask` patches it optimistically (skipping populated reference
  fields like assignee/sprint/epic) and invalidates `Task` + `Tasks`.
- **Client state:** open task id, modal navigation stack (`navStack`), inline-edit buffers,
  selection for bulk.

## Loading / Empty / Error States
- **Loading:** spinner in the modal; list views keep previous data while refetching.
- **Empty:** per-view empty states (e.g. "Backlog is empty.", "No tasks match the current filters.").
- **Error:** optimistic edits roll back silently. Most modal handlers (`patch`, description
  save, add subtask, duplicate, delete) do not catch errors → unhandled rejection, no message.
  A `?task=` link to a deleted or inaccessible task leaves the modal on a spinner (404/403 is
  not rendered).

## Key journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path: create & share | quick add → (requiredFields? modal opens with nudge) → fill fields inline → Copy link | `KEY-n` assigned; reporter auto-watches; assignee notified; link is `/p/<id>/board?task=<id>` |
| Permission / read-only | viewer or expired workspace opens a task | all inputs disabled, no Duplicate/Archive/Delete, comment box replaced by a note; API would 403 |
| Failure / rollback | PATCH returns 422 (e.g. invalid type) | optimistic value reverts; no visible error |

## Development Tasks (Next Phases)
- [ ] Attachment upload (schema field `attachments` exists, no route/UI).
- [ ] Rich-text description/comments (schema comment says HTML; UI is plain text).
- [ ] UI to add dependencies and watchers (API accepts both; modal can only remove dependencies).
- [ ] Bulk key/reference copy for Git.
