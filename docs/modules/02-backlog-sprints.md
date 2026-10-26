---
covers: ["src/app/(app)/p/[projectId]/backlog/**", "src/app/api/sprints/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Backlog & Sprints

> `src/app/(app)/p/[projectId]/backlog/page.tsx:BacklogPage`.

## Purpose
Plan work into time-boxed sprints and run the Scrum lifecycle: draft a sprint, drag tasks
in from the backlog, start it, then complete it and roll over what's unfinished.

## Business Value
Turns a flat task list into committed iterations with capacity and velocity you can measure
(`committedPoints` / `completedPoints` snapshots feed the reports).

## Navigation Flow
1. Sidebar → project → Backlog & Sprints.
2. Create a sprint; drag backlog tasks into it; set capacity + dates + goal.
3. **Start** the sprint (only one active per project); later **Complete** it.
4. On complete, choose where incomplete tasks go (backlog or another *planned* sprint).

## Screens
### Backlog (`src/app/(app)/p/[projectId]/backlog/page.tsx`)
- Collapsible sections: each `planned`/`active` sprint (creation order) + the Backlog
  (tasks with `sprint: null`). Tasks still pointing at a completed/archived sprint appear in
  neither section.
- Per-sprint header: name, Active chip, goal, date range, issue count, `done/total pts`
  (done = status in a `done`-category column), `cap N`, and an "Over capacity" chip when total
  points exceed `capacity` (warning only).
- Lifecycle buttons (`sprint:manage` only): Start (planned), Complete (active), Edit, Delete.
  There is no Archive button although `sprintAction(_, "archive")` exists.
- `SprintForm` modal for create/edit (name, goal, start/end date, capacity).
- Complete dialog: select target = Backlog or another planned sprint.
- Cross-section drag reorders and reassigns a task's sprint.
- No quick create and no `?task=` deep link on this page (board only).

## UI Components
- `Row` (local), `SprintForm` (local), `FilterBar` / `BulkBar` / `ProjectHeader`
  (`src/components/project/common.tsx`), `Modal` (`src/components/ui.tsx`),
  `TaskModal` ([../ui/task-modal.md](../ui/task-modal.md)).

## Data Dependencies
- **MongoDB:** `Sprint` (lifecycle + point snapshots), `Task` (sprint assignment/order),
  `Project` (done categories). Fields: [../database/entities.md](../database/entities.md).

## API Dependencies
- `GET /api/sprints?project=`, `POST /api/sprints`, `PATCH /api/sprints/[id]` (fields or
  `action: start|complete|archive`), `DELETE /api/sprints/[id]` — see
  [../api/sprints.md](../api/sprints.md).
- `GET /api/tasks?project=&sort=order&limit=200`, `POST /api/tasks/reorder` (drag),
  `PATCH /api/tasks/bulk` — see [../api/tasks.md](../api/tasks.md).

## State Management
- **Server state:** RTK Query `getSprints` + `getTasks` (URL-keyed). Sprint mutations
  invalidate `Sprints` and `Tasks`, so both lists refetch.
- **Client state:** collapsed sections, sprint modal, complete-sprint dialog (`moveTo`),
  selection.
- **Optimistic drag:** patches `task.sprint`/`order` in the `getTasks` cache, then
  `POST /api/tasks/reorder` with `sprint` (null for Backlog); `patch.undo()` on failure.
  `reorderTasks` declares no `invalidatesTags`, so sprint header totals rely on the patched cache.

## Loading / Empty / Error States
- **Empty sprint:** "Drag tasks here to plan this sprint." (can edit) / "No tasks in this
  sprint." (read-only); **Empty backlog:** "Backlog is empty."
- **Errors:** Start errors (second active sprint → 409, not planned → 400) show an `alert`.
  `doCompleteSprint` and `deleteSprint` have no `try/catch`: a 4xx leaves the dialog open with
  no message and an unhandled promise rejection in the console.

## Key journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path: run a sprint | New sprint → drag tasks in (`reorder` with `sprint`, logs "moved to sprint") → Start (`committedPoints` snapshot, end date defaults to +14 days) → Complete with target | `completedPoints` snapshot; incomplete tasks moved via one `updateMany` (no per-task activity); `sprint.completed` activity; notification to project guests only (see [../api/sprints.md](../api/sprints.md)) |
| Permission / read-only | no `sprint:manage` (editor/viewer, or expired workspace) | New sprint + lifecycle buttons hidden; no `task:edit` → rows not draggable; server returns 403 regardless |
| Failure / rollback | drag rejected | row returns to its section via `patch.undo()`; Start conflict → `alert` with server message |

## Development Tasks (Next Phases)
- [ ] Sprint capacity per assignee.
- [ ] Auto-carry sprint goal notes into the retro/report.
- [ ] Error handling for Complete/Delete; an Archive button (or remove the dead action).
