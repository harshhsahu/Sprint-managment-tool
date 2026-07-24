# Module: Tasks (and the Project Key)

> The core work-item model and its human-readable identifier.

## Purpose
Represent every unit of work (epic → story/task/bug/spike/improvement → subtask) and give
each one a short, stable, human-readable identifier — the **task key** (e.g. `CC-42`).

---

## Why the project "key" exists

When you create a project you must choose a short **key** (2–8 letters, e.g. `CC` for
"Cloud Console"). It is the prefix for every task id in that project. It exists because:

1. **Human-readable, stable IDs.** MongoDB `_id`s (`652f…a1b`) are unusable in
   conversation. `CC-42` is short, memorable, and speakable ("can you look at CC-42?").
2. **Numbering.** Each project has a `taskCounter`; creating a task increments it and sets
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
unique `{ project, key }` index. Assigned in `POST /api/tasks`. See
[../database/entities.md](../database/entities.md).

---

## Business Value
Fast, unambiguous reference to any piece of work across the board, the backlog, search,
notifications, Git history, and standups.

## Navigation Flow
1. Open any project view (board/list/backlog) or search.
2. Click a card/row → the **task modal** opens (deep-linkable via `?task=<id>`).
3. Edit inline; jump to related items (epic, subtasks, dependencies).

## Screens
### Task modal (`src/components/TaskModal.tsx`)
Title, rich fields (status/assignee/reporter/type/priority/sprint/epic/points/due/labels/
watchers), description, subtasks, dependencies, comments, and activity — all inline-editable
subject to capabilities. See [../ui/task-modal.md](../ui/task-modal.md).

## Task Types
`epic` (container) · `story` · `task` · `bug` · `spike` · `improvement` · `subtask`
(has a `parentTask`). Types are cosmetic + organizational (icon/color) except `subtask`/`epic`
which imply parent/child relationships.

## Data Dependencies
- **MongoDB:** `Task` (+ `Comment`, `Activity`), parent `Project` (statuses/labels/key/counter).

## API Dependencies
- `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/[id]`,
  `/api/tasks/[id]/comments`, `/api/tasks/[id]/duplicate`, `/api/tasks/bulk`,
  `/api/tasks/reorder`. See [../api/tasks.md](../api/tasks.md).

## State Management
- **Server state:** SWR on the task list + `GET /api/tasks/[id]` in the modal.
- **Client state:** modal open (`?task=`), inline-edit buffers, multi-select for bulk.

## Loading / Empty / Error States
- **Loading:** spinner in the modal; `keepPreviousData` on filtered lists.
- **Empty:** empty-state per view (e.g. "Backlog is empty.").
- **Error:** inline message; failed optimistic reorder reconciles on revalidate.

## Development Tasks (Next Phases)
- [ ] Attachment upload (schema field exists).
- [ ] Rich-text description/comments.
- [ ] Bulk key/reference copy for Git.
