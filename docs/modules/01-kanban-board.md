# Module: Kanban Board

> The default project view. `src/app/(app)/p/[projectId]/board/page.tsx`.

## Purpose
Visualize and move work across workflow columns with drag & drop, scoped to the active
sprint (or all tasks).

## Business Value
The at-a-glance "what's in progress / who's on what / what's stuck" view teams live in daily.

## Navigation Flow
1. Sidebar → project → Board (default).
2. Drag cards between columns; click a card to open the task modal.
3. Switch swimlanes / sprint scope; filter; multi-select for bulk actions.

## Screens
### Board (`board/page.tsx`)
- Columns from `project.statuses` (ordered), each showing count and WIP limit.
- **WIP limits:** a column over its `wipLimit` is flagged (not blocked).
- **Swimlanes:** none / assignee / priority / epic (client-side grouping).
- **Scope:** active sprint (default) or all tasks.
- **Quick create** per column; **bulk bar** for multi-selected cards.

## UI Components
- `TaskCard`, `FilterBar`, `BulkBar` (see `src/components/project/common.tsx`), `TaskModal`.

## Data Dependencies
- **MongoDB:** `Task` (filtered by project/sprint), `Sprint` (active), `Project` (statuses).

## API Dependencies
- `GET /api/tasks`, `POST /api/tasks` (quick create), `POST /api/tasks/reorder`,
  `PATCH /api/tasks/[id]` (status side-effects), `PATCH /api/tasks/bulk`.

## State Management
- **Server state:** SWR on the filtered task list (`keepPreviousData`).
- **Client state:** swimlane, sprint scope, filters, selection, open task.
- **Optimistic:** drag updates the SWR cache immediately, then reconciles.

## Loading / Empty / Error States
- **Loading:** spinner; **Empty:** empty columns show a subtle add affordance.
- **Error:** failed reorder reverts on revalidate; permission errors surface from the API.

## Development Tasks (Next Phases)
- [ ] Card cover / customizable card fields.
- [ ] Collapse/reorder columns from the board (currently in settings).
