---
covers: ["src/app/(app)/p/[projectId]/board/**", "src/components/project/common.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Kanban Board

> The default project view. `src/app/(app)/p/[projectId]/board/page.tsx:BoardPage`.

## Purpose
Visualize and move work across workflow columns with drag & drop, scoped to the active
sprint (or all tasks).

## Business Value
The at-a-glance "what's in progress / who's on what / what's stuck" view teams live in daily.

## Navigation Flow
1. Sidebar → project → Board (default). Notification, search, dashboard and "Copy link" URLs
   all land here as `/p/<projectId>/board?task=<taskId>`.
2. Drag cards between columns; click a card to open the task modal.
3. Switch swimlanes / sprint scope; filter; multi-select for bulk actions.

## Screens
### Board (`src/app/(app)/p/[projectId]/board/page.tsx`)
- Columns from `project.statuses` (array order), each showing count and `count/wipLimit`.
- **WIP limits:** a column over its `wipLimit` gets a red border + warning icon (not blocked).
- **Swimlanes:** none / assignee / priority / epic — client-side via
  `src/components/project/common.tsx:useGroups`. Dropping a card into another lane changes
  only its status, never the lane field (assignee/priority/epic).
- **Scope:** active sprint (default; adds `&sprint=<activeId>` to the query) or all tasks. With
  no active sprint the "active" option shows all tasks.
- **Quick create** per column (`QuickCreate`) — creates in that column's status and, in active
  scope, the active sprint. Stays open for rapid entry. If the project has `requiredFields`,
  the new task's modal opens immediately (soft nudge, see [03-tasks.md](03-tasks.md#required-fields-nudge)).
- **Bulk bar** (`src/components/project/common.tsx:BulkBar`) for multi-selected cards.
- **Deep link:** an effect reads `?task=` and opens `TaskModal`; closing it `router.replace`s
  back to `/p/<id>/board`.
- Fetch is capped at `limit=200`; tasks beyond that are not rendered.

## UI Components
- `TaskCard`, `FilterBar`, `BulkBar`, `ProjectHeader` (read-only banner) — all in
  `src/components/project/common.tsx`.
- `TaskModal` — see [../ui/task-modal.md](../ui/task-modal.md).
- `@hello-pangea/dnd` `DragDropContext` / `Droppable` (id `<laneKey>::<statusId>`) / `Draggable`.

## Data Dependencies
- **MongoDB:** `Task` (filtered by project/sprint), `Sprint` (active), `Project` (statuses,
  taskTypes, requiredFields). Field definitions: [../database/entities.md](../database/entities.md).

## API Dependencies
- `GET /api/projects/[id]` (via `useProject`), `GET /api/sprints?project=`,
  `GET /api/tasks?project=&sort=order&limit=200[&sprint=]`.
- `POST /api/tasks` (quick create), `POST /api/tasks/reorder` + `PATCH /api/tasks/[id]`
  (drag), `PATCH /api/tasks/bulk` (bulk bar). Contracts: [../api/tasks.md](../api/tasks.md).

## State Management
- **Server state:** RTK Query `getTasks` keyed by the full URL (`src/store/hooks.ts:useQ`
  wrapper keeps previous data while filters change).
- **Client state:** swimlane, sprint scope, filters, selection, open task (component state;
  not persisted).
- **Optimistic drag:** `onDragEnd` computes a fractional `order` between neighbours
  (`(before+after)/2`, `±1` at the ends, `1000` in an empty column), patches the `getTasks`
  cache with `api.util.updateQueryData`, then calls the API; on any failure `patch.undo()`.

### Drag write sequence (gotcha)
```ts
await reorderTasks({ project, updates: [{ id, order, status: changed ? dest : undefined }] }).unwrap();
if (changed) await updateTask({ id, set: { status: dest } }).unwrap();  // redundant today
```
`POST /api/tasks/reorder` now does the status side-effects itself (completedAt/startedAt,
activity, watcher notifications — added in `5ec7e9c`). The follow-up PATCH arrives after the
status is already persisted, so `src/app/api/tasks/[id]/route.ts:PATCH` sees no status diff and
does nothing except return the task and invalidate the `Tasks`/`Task` tags (which triggers the
refetch). Historically reorder only `$set` raw fields, so this reorder→PATCH order silently
dropped completedAt, activity and notifications for every board move. Do not remove the
side-effects from reorder on the assumption that the PATCH covers them. See
[../api/tasks.md](../api/tasks.md#status-write-paths).

## Loading / Empty / Error States
- **Loading:** `Spinner` until project and first task page load.
- **Empty:** empty columns still render with "Add task" (if `task:create`).
- **Error:** failed reorder/PATCH → card snaps back (`patch.undo()`); no message shown. If the
  reorder succeeded but the PATCH failed, the card snaps back even though the server already
  moved it — UI is stale until the next refetch. Quick-create errors show an `alert`.

## Key journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path: move card to Done | drag → optimistic move → `POST /api/tasks/reorder` (stamps `completedAt`, logs `task.updated`, notifies watchers) → `PATCH /api/tasks/[id]` (no-op) → tag invalidation refetch | card stays in Done; task appears in the reports Done calendar |
| Permission / read-only | `useProject` returns `myCapabilities` without `task:edit` (viewer, or any role when the workspace trial/plan expired → only `project:view`) | `Draggable isDragDisabled`, no QuickCreate, BulkBar hidden, `ProjectHeader` shows the red "read-only" banner; server would 403 anyway |
| Failure / rollback | reorder returns 403/422/500 | `patch.undo()` returns the card; no toast |
| Deep link | open `/p/<id>/board?task=<taskId>` | modal opens on top of the board; closing strips `?task=` |

## Development Tasks (Next Phases)
- [ ] Card cover / customizable card fields.
- [ ] Collapse/reorder columns from the board (currently in settings).
- [ ] Drop the redundant post-reorder PATCH (or keep it only as the tag-invalidation trigger) and surface a toast on rollback.
- [ ] Changing swimlane on drop (assign by dragging between assignee lanes).
