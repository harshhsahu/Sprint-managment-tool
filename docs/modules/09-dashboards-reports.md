---
covers: ["src/app/(app)/dashboard/**", "src/app/(app)/p/[projectId]/reports/**", "src/app/(app)/my-tasks/**", "src/components/TaskJourneyModal.tsx", "src/app/api/dashboards/**", "src/app/api/reports/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Dashboards, Reports & My Tasks

> Cross-project dashboard (customizable widgets), per-project reports incl. the Done
> Calendar, and the My Tasks list. Endpoint contracts: [../api/insights.md](../api/insights.md).

## Purpose
- **Dashboard** (`/dashboard`): "what's on my plate and how are my teams trending?" across
  every project the user can see.
- **Reports** (`/p/[projectId]/reports`): sprint, distribution, flow and completion history
  for one project.
- **My Tasks** (`/my-tasks`): every task assigned to / reported by me, grouped by project.

---

## Business Value
Gives team members a personal landing view and gives workspace owners / project leads trend
views (growth, velocity, throughput, per-person output) without exporting data. The
owner/lead "Team Growth" board is seeded automatically for those users.

---

## Navigation Flow
1. Sidebar → Dashboard / My Tasks (top links); project sub-nav → Reports.
2. Dashboard: pick a board from the selector → adjust the filter bar → "Customize" to
   add/remove/resize/configure widgets. Reports: switch tabs.
3. Task rows link to `/p/[projectId]/board?task=[taskId]`; Done Calendar items open
   `src/components/TaskJourneyModal.tsx:TaskJourneyModal`; My Tasks rows open `TaskModal`.

---

## Screens

### 1. Dashboard (`src/app/(app)/dashboard/page.tsx`)
- **Header:** board selector, "New dashboard" (Blank — actually seeded with one
  `assigned_to_me` widget — or "Team Growth template"), delete (only while customizing and when
  > 1 board), Customize/Done toggle.
- **Filter bar** (`FilterBar`): Projects, People (incl. "Unassigned"), Priority multi-selects,
  Lead select, Range select (`30d|90d|6m|12m`). "Clear all" resets to `EMPTY_FILTERS`.
  Options come from the page-level data fetch (full visible scope).
- **Widget grid** (`Widget`): 2 columns on md+, `w: 2` spans both. 13 widget types
  (labels in `WIDGET_LABELS`). Chart-type choices per widget in `CHART_OPTIONS`;
  `RANGE_WIDGETS` = `project_growth`, `throughput`, `team_growth`.
- **Widget config** (`WidgetConfig` modal): graph type, range override (range widgets only),
  projects override, people override. A widget with any override shows a "scoped" chip.

### 2. Reports (`src/app/(app)/p/[projectId]/reports/page.tsx`)
| Tab | Data | Content |
|---|---|---|
| Sprint Reports | `type=velocity`, `type=burndown[&sprint=]` | velocity bars, burndown, burnup, sprint completion % list; sprint picker lists sprints with a `startDate` (fetched with `archived=1`) |
| Project Reports | `type=distribution`, `type=aging` | status/type/priority donuts, workload by assignee, aging & blocked table (red when > 30 d) |
| Flow Metrics | `type=flow` | avg cycle/lead time, 8-week throughput, 30-day cumulative flow |
| Done Calendar | `GET /api/tasks?project&limit=200&completedAfter&completedBefore` | Monday-first month grid; tasks placed by local-date `completedAt`; 3 per cell + "+N more" day modal |

Only the active tab's queries run (others pass `null` → skipped).

### 3. My Tasks (`src/app/(app)/my-tasks/page.tsx`)
Scope select (`assignee=me` / `reporter=me`), `sort=dueDate&limit=100`, grouped by project
using `useQ.useProjects()` for names/status colours. Total count shows `total` from the API.

---

## UI Components
- `src/components/ui.tsx`: `Spinner`, `Avatar`, `TypeIcon`, `PriorityBadge`, `Modal`, `EmptyState` (shared — see [../ui/](../ui/))
- `src/components/TaskJourneyModal.tsx:TaskJourneyModal` (feature) — created → status
  transitions → done, built from the task's Activity log via `GET /api/tasks/[id]`.
- `src/components/project/common.tsx:ProjectHeader` / `useProject` (reports)
- Charts: `recharts` (Pie, Bar, Line, Area). Dashboard colour palette `PIE_COLORS` is
  duplicated in the reports page.

---

## Data Dependencies
1. **`GET /api/dashboards/data`** — one payload containing every widget's slice; scope rules
   in [../api/insights.md](../api/insights.md#get-apidashboardsdata).
2. **`GET /api/reports/[projectId]`** — per-tab aggregates.
3. **`Task.completedAt`** — Done Calendar, throughput, growth and flow all bucket by it. It is
   stamped by all three status write paths (`PATCH /api/tasks/[id]`, `POST /api/tasks/reorder`,
   `PATCH /api/tasks/bulk`) — see [03-tasks.md](03-tasks.md).
4. **`Sprint.committedPoints` / `completedPoints`** — snapshotted at sprint start/complete
   (velocity widgets & report).

---

## State Management
- **Server state:** RTK Query via `src/store/hooks.ts:useQ` (`useDashboards`,
  `useDashboardData`, `useReports`, `useTasks`, `useSprints`). `useSwrLike` keeps the previous
  result while a new arg loads, so filter changes don't flash spinners.
- **Per-widget fetch + dedup:** each `Widget` calls `useQ.useDashboardData(buildQuery(...))`
  with its effective query (widget override ‖ global filter). RTK Query caches by URL, so all
  override-free widgets and the page-level options fetch share **one** request; each distinct
  override set costs one more full `/api/dashboards/data` computation.
- **Stable range token:** `buildQuery` sends `range=90d` etc., never `from`/`to`
  timestamps — a timestamp changes every render, which would produce a new cache key and
  refetch loop (decision in `b3ed8f6`).
- **Polling:** every dashboard data subscription polls at 60 s. `getDashboardData` has no
  `providesTags`, so task edits elsewhere are reflected only on the next poll or remount.
- **Client state:** `filters` (`useState`), loaded from the active board's saved `filters`
  via a render-phase guarded setState (`loadedFor`), not an effect. Every filter change is
  persisted fire-and-forget through `useSaveDashboardMutation` (invalidates `Dashboards`).
- **Template duplication:** `TEAM_GROWTH_TEMPLATE` exists in both
  `src/app/api/dashboards/route.ts` (server seeding) and the page (New-dashboard modal) — keep
  them in sync.

---

## API Dependencies
- `GET /api/dashboards`, `POST /api/dashboards`, `DELETE /api/dashboards?id=`
- `GET /api/dashboards/data`
- `GET /api/reports/[projectId]?type=velocity|burndown|distribution|flow|aging`
- `GET /api/sprints?project=&archived=1` ([sprints.md](../api/sprints.md))
- `GET /api/tasks` ([tasks.md](../api/tasks.md)) — Done Calendar, My Tasks
- `GET /api/tasks/[id]` — journey modal

---

## Loading / Empty / Error States
- **Loading:** page-level `Spinner` until dashboards/project load; per-widget/chart `Spinner`
  until its query resolves.
- **Empty:** per widget ("Nothing assigned to you", "No active sprints.", "No data in range.",
  "No completed sprints yet."); empty board → `EmptyState` with "Add widget"; reports cards
  have their own empty copy (e.g. "Complete a sprint to see velocity.").
- **Error:** none surfaced. Failed queries leave the spinner (or last kept data) in place;
  `saveDashboard` failures from filter changes are not caught or shown. 401s redirect to
  `/login` via the base query in `src/store/api.ts`.

---

## Key Journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path — owner first visit | Open `/dashboard` → `GET /api/dashboards` seeds "My Dashboard" + "Team Growth" → widgets fetch `/api/dashboards/data?range=90d` (one request) | Both boards available in the selector |
| Scoped widget | Customize → ⚙ on Throughput → range 12m, Projects = A → Save | Widget shows "scoped", fetches its own query; others unchanged |
| Done Calendar | Reports → Done Calendar → ‹ › months → click a task | Journey modal shows who created it and who moved it to Done |
| Permission branch | Non-member opens `/p/[id]/reports` | Project load fails, so `useProject` returns no project and the page stays on "Loading reports…" (no 403 message); `GET /api/reports/[id]` would also 403 |
| Permission branch — visibility | Dashboard only aggregates projects in the user's workspaces or where they are a guest | Other tenants' data never appears; but `excludedMembers` are **not** filtered out (see Notes) |
| Failure | Network/500 on `/api/dashboards/data` | Widgets keep spinning or show last data; no toast |

---

## Notes & Limits
> [!WARNING]
> **Done Calendar truncates at 200 tasks per month** (`limit=200`, the `GET /api/tasks` max);
> no paging or "more" indicator. Busy projects silently lose days late in the month.

- **My Tasks** caps at 100 (`limit=100`), no pagination, though the header shows the full `total`.
- **Dashboard data** loads every non-archived task in the visible scope and aggregates in Node;
  `sprintProgress` issues one query per active sprint. Cost scales with all visible projects.
- **Status ids collide across projects:** `byStatus` counts by status id and the widget labels
  each id with the first project's matching name — the same id in two projects merges.
- **Widget id collision:** new widgets get id `w{count+1}_{type}`. Remove one widget then add
  the same type again and the id can duplicate an existing one (React key clash; config/remove
  then act on the first match).
- **Burndown `sprint=`** is not validated against the project (see API doc).
- **Journey "moved to Done by"** is found by string-matching `→ <DoneStatusName>` in Activity
  `detail` — changing the activity detail format in the task PATCH breaks it.
- The "Blank dashboard" option is not blank (one `assigned_to_me` widget) and uses
  `window.prompt` for the name.
- `team_workload` and `by_assignee` render identical charts from the same data.

---

## Development Tasks (Next Phases)
> [!TODO]
> No roadmap items for dashboards/reports were found in the repo. Candidate fixes from the
> notes above (Done Calendar paging, `excludedMembers` scoping, burndown sprint check, widget
> id generation) need a human to prioritise.
