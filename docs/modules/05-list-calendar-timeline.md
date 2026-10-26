---
covers: ["src/app/(app)/p/[projectId]/list/**", "src/app/(app)/p/[projectId]/calendar/**", "src/app/(app)/p/[projectId]/timeline/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: List, Calendar & Timeline views

> Three alternate read-mostly lenses on a project's tasks. Sidebar entries live in
> `src/components/AppShell.tsx`; pages under `src/app/(app)/p/[projectId]/`.

## Purpose
Show the same tasks as a sortable/groupable table (List), by due date (Calendar), or as a
created→due bar chart grouped by epic (Timeline). All three open the shared `TaskModal`.

## Business Value
Spreadsheet-style triage and fast inline edits (List); deadline visibility (Calendar);
a lightweight roadmap without a separate planning tool (Timeline).

## Navigation Flow
1. Sidebar → project → List / Calendar / Timeline.
2. Filter (List, Calendar), sort/group (List), page months (Calendar), switch scope (Timeline).
3. Click a row/chip/bar → `TaskModal`. None of these pages read `?task=` (board only).

## Screens
### List (`src/app/(app)/p/[projectId]/list/page.tsx:ListPage`)
| Feature | Behaviour |
|---|---|
| Columns | `COLUMNS`: key, title, status, priority, assignee, storyPoints, sprint, dueDate; "Columns" menu toggles visibility (component state, not persisted) |
| Sort | header click toggles `field` / `-field`, sent as `sort=` to `GET /api/tasks` (default `-createdAt`). Mongo sorts raw values, so status sorts by status id and assignee/sprint by ObjectId, not by name/board order |
| Group | none / status / assignee / priority / sprint / epic / type via `src/components/project/common.tsx:useGroups` — groups only the **current page** |
| Paging | `page=&limit=50`, Prev/Next when `pages > 1`. `page` is not reset when filters change |
| Inline edit | status, priority, assignee `<select>`s → `inlinePatch`: optimistic `updateQueryData` on the list cache, then `updateTask` (`PATCH /api/tasks/[id]`), `patch.undo()` on failure |
| Quick add | title only → `POST /api/tasks` (first status, no sprint); opens the modal when `project.requiredFields` is set |
| Bulk | header checkbox selects the current page → `BulkBar` |

### Calendar (`src/app/(app)/p/[projectId]/calendar/page.tsx:CalendarPage`)
- Monday-first month grid; prev/next/Today buttons.
- Fetches `GET /api/tasks?project=&limit=200&dueAfter=<1st of month>&dueBefore=<last day + 1d>`
  plus `FilterBar` params. Leading/trailing days from adjacent months are drawn but their
  tasks are not fetched.
- A day shows up to 3 chips (left border = priority colour); "+N more" opens a day `Modal`.
- Day matching uses local `toDateString()`; due dates are stored as UTC midnight from
  `<input type="date">`, so users west of UTC may see a task one day early.
- No drag-to-reschedule; edits happen in the modal.

### Timeline (`src/app/(app)/p/[projectId]/timeline/page.tsx:TimelinePage`)
- Fetches `GET /api/tasks?project=&limit=200&sort=createdAt` and `GET /api/sprints?project=`.
- **Roadmap (by epic)** (default): one bar per `type === "epic"` task with its children
  (`task.epic` match) underneath. Falls back to the "all" layout when the project has no epics.
- **All tasks with dates:** tasks that have `dueDate` (plus epics).
- Bar = `createdAt` → `dueDate` (or +7 days when no due date); colour from
  `resolveTaskType(...).color`. There is no start-date field — `createdAt` is used as start.
- Window = min(created, due, sprint dates) −3d to max +7d, at least 14 days; month markers and
  a red "today" line. Sprints only widen the window — they are not drawn.
- Read-only view (no filters, no drag).

## UI Components
- `FilterBar`, `BulkBar`, `ProjectHeader`, `useGroups` (`src/components/project/common.tsx`).
- `TypeIcon`, `PriorityBadge`, `Avatar`, `Modal`, `EmptyState`, `Spinner` (`src/components/ui.tsx`).
- `TaskModal` — [../ui/task-modal.md](../ui/task-modal.md).

## Data Dependencies
- **MongoDB:** `Task`, `Sprint` (timeline window), `Project` (statuses, taskTypes,
  customFields, members).

## State Management
- **Server state:** RTK Query `getTasks` keyed by full URL; `useQ.useTasks` keeps previous
  data across filter/page changes.
- **Client state:** filters, sort, groupBy, visible columns, page, month, timeline scope,
  selection — all component state, reset on navigation.

## API Dependencies
- `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/[id]`, `PATCH /api/tasks/bulk`,
  `GET /api/sprints`, `GET /api/projects/[id]` — [../api/tasks.md](../api/tasks.md),
  [../api/sprints.md](../api/sprints.md).

## Loading / Empty / Error States
- **Loading:** `Spinner` until project + first data.
- **Empty:** List "No tasks match the current filters."; Timeline `EmptyState` "Nothing to
  plot yet"; Calendar just shows empty days.
- **Error:** List inline edits revert silently; list quick add has no `try/catch` (unhandled
  rejection, e.g. 403). Calendar/Timeline only render what loaded (cap 200 tasks).

## Known gaps (code-verified)
- List inline **assignee** options come from `project.members` (project guests only), while
  the modal, filters and BulkBar use `src/lib/utils.ts:projectAssignees` (workspace owner +
  members + guests). Workspace members are therefore missing from the List assignee dropdown.
- The optimistic list patch writes the bare assignee id over the populated object until the
  refetch lands (Avatar briefly blank).

## Key journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path: triage in List | filter → group by status → change priority/status inline | instant cell update; `PATCH /api/tasks/[id]` applies status side-effects (completedAt, activity, notify) |
| Permission / read-only | no `task:edit` / `task:create` (viewer or expired workspace) | List selects `disabled`, quick add hidden, BulkBar hidden; Calendar/Timeline unchanged (already read-only); modal fields disabled |
| Failure / rollback | inline PATCH rejected (403/422) | `patch.undo()` restores the cell, no message |

## Development Tasks (Next Phases)
- [ ] Use `projectAssignees` for the List assignee dropdown.
- [ ] Reset `page` to 1 when filters/sort change.
- [ ] Persist list column/group preferences; drag-to-reschedule on Calendar; draw sprints on Timeline.
