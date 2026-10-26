---
covers: ["src/app/api/sprints/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Sprints

> Handlers in `src/app/api/sprints/route.ts` and `src/app/api/sprints/[id]/route.ts`.
> Powers Backlog & Sprints, the board's active-sprint scope, BulkBar/TaskModal sprint pickers,
> the timeline window, and sprint reports.

## Purpose
Create, edit, run (start → complete) and remove time-boxed sprints for one project.
Same conventions as [tasks.md](tasks.md): `withAuth` (401), zod `parseBody` (422),
`{ error }` envelope. Writes require `sprint:manage` (owner/admin; nobody when the
workspace trial/plan is expired).

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/sprints` | GET | list a project's sprints (any project role) |
| `/api/sprints` | POST | create a planned sprint — `sprint:manage` |
| `/api/sprints/[id]` | PATCH | edit fields, or `action: start \| complete \| archive` — `sprint:manage` |
| `/api/sprints/[id]` | DELETE | delete a non-active sprint — `sprint:manage` |

Status lifecycle (`SprintSchema.status`): `planned → active → completed`; `archived` can be
set from any state.

---

## GET /api/sprints

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `project` | id | required (400 "project query param is required"); 403 if no role |
| `archived` | `1` | include archived sprints (excluded by default) |

### Response — 200
```ts
{ sprints: Sprint[] }   // sorted by createdAt ascending; completed sprints included
```

## POST /api/sprints
### Body
```ts
{ project: string; name: string /*1–80*/; goal?: string /*≤500*/; startDate?: string; endDate?: string; capacity?: number /*0–1000*/ }
```
Creates `status: "planned"`, logs `sprint.created`, returns `201 { sprint }`. Dates are not
validated against each other.

## PATCH /api/sprints/[id]
### Body
```ts
{
  name?: string; goal?: string; startDate?: string|null; endDate?: string|null; capacity?: number;
  action?: "start" | "complete" | "archive";
  moveIncompleteTo?: string|null;   // with "complete": target sprint id, null/omitted = backlog
}
```
Order of checks: 404 → 403 (`sprint:manage`) → body validation. When `action` is present
the field updates in the same body are ignored.

| action | Guard | Effect |
|---|---|---|
| `start` | 400 unless `planned`; 409 if another sprint in the project is `active` | `status=active`; defaults `startDate` to now and `endDate` to now + 14 days; `committedPoints` = sum of non-archived task points; `sprint.started` activity; `sprint` notification |
| `complete` | 400 unless `active` | `completedPoints` = points of tasks in a `done`-category status; `status=completed`, `completedAt=now`; non-done tasks moved to `moveIncompleteTo` (or backlog) by one `updateMany`; `sprint.completed` activity ("N done, M moved"); `sprint` notification linking to reports |
| `archive` | none | `status=archived`, `sprint.archived` activity |
| (none) | — | apply provided fields, `sprint.updated` activity |

Returns `{ sprint }`.

## DELETE /api/sprints/[id]
400 "Cannot delete an active sprint. Complete it first." for active sprints; otherwise sets
`sprint: null` on all its tasks (→ backlog), deletes the sprint, logs `sprint.deleted`.
Returns `{ ok: true }`.

### Behavior Notes
- **Notification audience:** start/complete notify `project.members` only. That array holds
  project *guests*; workspace members (who get access to every project via the workspace,
  see [../modules/04-roles-permissions.md](../modules/04-roles-permissions.md)) are not in it,
  so most teams receive no sprint notifications.
- `moveIncompleteTo` is not validated (could be a completed sprint or another project's id).
  The UI only offers planned sprints of the same project.
- `archive` on an **active** sprint leaves the project with no active sprint and its tasks
  attached to an archived sprint (hidden from the backlog sections). The backlog UI exposes no
  Archive button.
- Moving tasks on complete/delete uses `updateMany` — no per-task "moved to backlog" activity.
- Only one active sprint per project is enforced in `start`, not by an index.

### Example
```json
{ "action": "complete", "moveIncompleteTo": null }
```
