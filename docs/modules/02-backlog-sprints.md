# Module: Backlog & Sprints

> `src/app/(app)/p/[projectId]/backlog/page.tsx`.

## Purpose
Plan work into time-boxed sprints and run the Scrum lifecycle: draft a sprint, drag tasks
in from the backlog, start it, then complete it and roll over what's unfinished.

## Business Value
Turns a flat task list into committed iterations with capacity and velocity you can measure.

## Navigation Flow
1. Sidebar → project → Backlog & Sprints.
2. Create a sprint; drag backlog tasks into it; set capacity + dates + goal.
3. **Start** the sprint (only one active per project); later **Complete** it.
4. On complete, choose where incomplete tasks go (backlog or another sprint).

## Screens
### Backlog (`backlog/page.tsx`)
- Collapsible sections: each planned/active sprint + the Backlog.
- Per-sprint header shows issue count, done/total points, capacity + over-capacity warning,
  and lifecycle actions (Start / Complete / edit / delete).
- Cross-section drag reorders and reassigns a task's sprint.

## Data Dependencies
- **MongoDB:** `Sprint` (lifecycle + point snapshots), `Task` (sprint assignment/order), `Project` (done categories).

## API Dependencies
- `GET/POST /api/sprints`, `PATCH/DELETE /api/sprints/[id]` (with `action: start|complete|archive`),
  `POST /api/tasks/reorder` (drag), `PATCH /api/tasks/bulk`.

## State Management
- **Server state:** SWR on sprints + filtered tasks.
- **Client state:** collapsed sections, complete-sprint dialog (move-target), selection.

## Loading / Empty / Error States
- **Empty sprint:** "Drag tasks here to plan this sprint."; **Empty backlog:** "Backlog is empty."
- **Errors:** starting a second active sprint / completing with none active are blocked with a message.

## Development Tasks (Next Phases)
- [ ] Sprint capacity per assignee.
- [ ] Auto-carry sprint goal notes into the retro/report.
