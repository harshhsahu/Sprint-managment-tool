---
covers: ["src/app/api/dashboards/**", "src/app/api/reports/**", "src/app/api/search/**", "src/app/api/activity/**", "src/app/api/filters/**", "src/app/api/notifications/**", "src/app/api/users/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Insights (dashboards, reports, search, activity, filters, notifications, users)

> Read-mostly routes behind the dashboard, project reports, ⌘K search, activity log, saved
> filters, notifications bell and user pickers. Envelope, `withAuth()` and Zod parsing follow
> [../12-api-guidelines.md](../12-api-guidelines.md). Field shapes of `Dashboard`,
> `Notification`, `Activity`, `SavedFilter` live in [../database/entities.md](../database/entities.md).

## Purpose
Aggregate task/sprint/activity data for read-only views, and store per-user preferences
(dashboards, saved filters, notification read state). Screens:
[../modules/09-dashboards-reports.md](../modules/09-dashboards-reports.md),
[../modules/10-notifications-search-activity.md](../modules/10-notifications-search-activity.md).

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/dashboards` | GET | list my dashboards; seeds defaults on first call |
| `/api/dashboards` | POST | create (no `_id`) or update (with `_id`) a dashboard |
| `/api/dashboards?id=` | DELETE | delete one of my dashboards (keeps ≥ 1) |
| `/api/dashboards/data` | GET | all widget data for a filter scope, in one payload |
| `/api/reports/[projectId]?type=` | GET | velocity / burndown / distribution / flow / aging |
| `/api/search?q=` | GET | global search: tasks, projects, sprints, people |
| `/api/activity` | GET | paginated activity log (project, task, or own) |
| `/api/filters` | GET / POST / DELETE | per-user saved list/board filters |
| `/api/notifications` | GET / PATCH | my notifications + unread count; mark read |
| `/api/users` | GET | list active users (pickers) |
| `/api/users/[id]` | PATCH | super-admin: activate/deactivate, designation |

Invitations shown in the bell (`GET /api/invites`, `PATCH /api/invites/[id]`) are project-invite
routes — see [projects.md](projects.md).

Auth on every route: `src/lib/apiHelpers.ts:withAuth` → 401 when no session. None of these
routes check the workspace read-only state (`src/lib/permissions.ts:isProjectReadOnly`):
dashboards/filters/notification writes are per-user preferences and stay writable on a lapsed plan.

---

## GET /api/dashboards

### Purpose
Return the caller's dashboards (oldest first). First call ever seeds them.

### Behavior Notes
- No dashboards yet → creates "My Dashboard" (`isDefault: true`, widgets `assigned_to_me`,
  `sprint_progress`, `by_status`, `upcoming_deadlines`, `recent_activity` w=2).
- Same first call: if the user owns any workspace **or** is `lead` of any project, also creates
  "Team Growth" from `src/app/api/dashboards/route.ts:TEAM_GROWTH_TEMPLATE`. Seeding runs only
  when the user has zero dashboards — becoming a lead later does not add it.

### Response — 200
```ts
{ dashboards: Dashboard[] }  // Dashboard = { _id, user, name, isDefault, filters?, widgets[] }
```

## POST /api/dashboards

### Purpose
Upsert. `_id` present → `findOneAndUpdate({ _id, user })` (404 if not mine); absent → create (201).

### Body (Zod `upsertSchema`)
| Field | Type | Description |
|---|---|---|
| `_id` | string? | update target |
| `name` | string 1–60 | required on every call (the page re-sends the current name) |
| `widgets` | Widget[] ≤ 20 | full replacement array |
| `filters` | object? | global scope; only written when present |

Widget: `id` string, `type` one of `WIDGET_TYPES` (`assigned_to_me`, `sprint_progress`,
`recent_activity`, `by_status`, `by_priority`, `by_assignee`, `open_vs_closed`,
`upcoming_deadlines`, `team_workload`, `project_growth`, `velocity_trend`, `throughput`,
`team_growth`), `w` 1–2 (default 1), `project` id|null (legacy, unused by the UI),
`chartType` `pie|donut|bar|line|area`|null, `range` `30d|90d|6m|12m`|null, `projects` id[],
`assignees` string[] (user ids or `unassigned`).

Filters: `projects` id[], `assignees` string[], `lead` id|null, `range` token|null,
`priority` string[], `type` string[].

> [!WARNING]
> A new widget/filter field must be added in three places or it is silently dropped: Zod
> `widgetSchema`/`filtersSchema` here, the `DashboardSchema` sub-schema in `src/models/index.ts`
> (keep `filters` a `new Schema` — a plain object with a `type` key makes Mongoose treat it as
> `[String]`), and the client `Filters` type in `src/app/(app)/dashboard/page.tsx`.

### Response — 200 / 201
```ts
{ dashboard: Dashboard }
```

## DELETE /api/dashboards?id=

- 400 `id is required`; 400 `You must keep at least one dashboard` when the user has ≤ 1.
- Deletes only `{ _id, user }` — another user's id is a silent no-op that still returns `{ ok: true }`.

---

## GET /api/dashboards/data

### Purpose
Compute every widget's data for one filter scope. All widgets read the same payload; the
client picks the slice it renders.

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `projects` | csv ids | narrow to these visible projects |
| `assignees` | csv | user ids; literal `unassigned` matches `assignee: null` |
| `lead` | user id | only projects whose `lead` is this user |
| `priority` | csv | task priority |
| `type` | csv | task type (API-only; the UI filter bar has no type control) |
| `range` | `30d`\|`90d`\|`6m`\|`12m` | window for time-series fields; default/unknown → 90 days (`6m` = 183, `12m` = 365) |
| `from`,`to` | ISO | override `range` (not sent by the UI) |

### Data Sources
| Field | Source | Notes |
|---|---|---|
| `assignedToMe` | `Task` | assignee = me, newest-updated, limit 30 |
| `sprintProgress` | `Sprint` (active) + `Task` | one extra Task query per active sprint |
| `byStatus`, `byPriority` | `Task` | `{ [statusId \| priority]: count }` — status **ids**, not names |
| `byAssignee` | `Task` | `{ id, name, avatarColor, count, done }[]`; also feeds `team_workload` |
| `openVsClosed` | `Task` | done = status in a `done`-category column of its project |
| `upcomingDeadlines` | `Task` | `dueDate ≤ now + 14d` (overdue included), limit 20 |
| `recentActivity` | `Activity` | project-scoped, limit 15 |
| `growth`, `throughput`, `teamGrowth` | `Task.createdAt` / `Task.completedAt` | bucketed daily if span ≤ 31 days, else weekly |
| `velocity` | `Sprint` completed/archived | `committedPoints`/`completedPoints`, last 12 by `completedAt` |
| `range` | computed | `{ from, to, step: "day" \| "week" }` |
| `people`, `leads`, `projects` | full visible scope | filter-bar options; never narrowed by filters |

Visible scope = non-archived projects in any workspace where the user is `owner` or in
`members.user`, plus projects where the user is a guest (`Project.members.user`).

### Response — 200
```ts
{
  assignedToMe: Task[]; sprintProgress: { sprint, projectName, total, done, totalPts, donePts }[];
  byStatus: Record<string, number>; byPriority: Record<string, number>;
  byAssignee: { id: string; name: string; avatarColor: string; count: number; done: number }[];
  openVsClosed: { open: number; closed: number };
  upcomingDeadlines: Task[]; recentActivity: Activity[];
  growth: { label: string; created: number; completed: number; open: number }[];
  throughput: { label: string; completed: number }[];
  teamGrowth: { people: { name: string; color: string }[]; rows: Record<string, number | string>[] };
  velocity: { name: string; committed: number; completed: number }[];
  range: { from: string; to: string; step: "day" | "week" };
  people: { id: string; name: string; color: string }[];
  leads: { id: string; name: string }[];
  projects: { _id, name, key, statuses, lead: { _id, name } | null }[];
}
```

### Behavior Notes
- Snapshot fields ignore `range`; only `growth`/`throughput`/`teamGrowth` use it.
- `growth.open` is a running count seeded from (created before `from`) − (completed before
  `from`), clamped at 0 — an approximation, not a historical snapshot.
- `teamGrowth.rows` are keyed by assignee **name**; two people with the same name merge.
- No caching server-side. `allTasks` is loaded unbounded for the scope and aggregated in
  Node — cost grows with total tasks across all visible projects.
- Visible scope does **not** honour `Project.excludedMembers` (unlike
  `src/lib/permissions.ts:getProjectRole`) — an excluded workspace member still sees that
  project's tasks here.

---

## GET /api/reports/[projectId]

### Purpose
Per-project agile reports. Requires any project role (`getProjectRole`) else 403; 404 if the
project is gone; 400 `Unknown report type`.

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `type` | `velocity`\|`burndown`\|`distribution`\|`flow`\|`aging` | default `velocity` |
| `sprint` | id | burndown only; default = the project's active sprint |

### Response — 200 (by `type`)
```ts
// velocity — last 12 completed/archived sprints
{ velocity: { name: string; committed: number; completed: number }[] }
// burndown — empty when no sprint or sprint has no startDate
{ burndown: { date: string; remaining: number | null; ideal: number }[];   // null for future days
  burnup:   { date: string; completed: number | null; scope: number }[];
  sprint: { _id, name, totalPts } | null }
// distribution — non-archived tasks; status mapped to column name
{ byStatus, byPriority, byType, byAssignee: { name: string; value: number }[]; statuses }
// flow
{ avgLeadDays: number; avgCycleDays: number; throughput: { week: string; count: number }[];
  cfd: { date: string; todo: number; in_progress: number; done: number }[]; recent: FlowItem[] }
// aging — open tasks, oldest 200 fetched, top 30 by age returned
{ aging: { _id, key, title, status, priority, assignee, ageDays, blocked }[]; blocked: same[] }
```

### Behavior Notes
- `sprint=` is **not** checked against `projectId` — any sprint id is accepted once the
  caller has a role on the URL's project.
- Burndown/burnup task sets include archived tasks (no `archived` filter); scope = sum of
  current `storyPoints`, so re-estimation rewrites history.
- `flow` samples the latest 100 tasks with `completedAt` (the code comment says 50); weekly
  throughput (8 weeks) is computed only from that sample. `cfd` is reconstructed from
  `createdAt`/`startedAt`/`completedAt`, not from status history.
- `aging.blocked` = task has any `dependencies`, regardless of whether they are done.
- The Done Calendar tab does not use this route — it calls `GET /api/tasks` with
  `completedAfter`/`completedBefore` (see [tasks.md](tasks.md)).

---

## GET /api/search?q=

### Purpose
⌘K / `/` global search. `q` shorter than 2 chars (after trim) → all arrays empty.

### Response — 200
```ts
{ tasks: Task[] /* ≤20, non-archived, title|key|description */;
  projects: { _id, name, key, workspace }[] /* ≤5 */;
  sprints: { _id, name, status, project }[] /* ≤5 */;
  users: { _id, name, email, avatarColor, designation }[] /* ≤5 */ }
```

### Behavior Notes
- Matching is a case-insensitive `$regex` built from raw `q` (not escaped, not the
  `TaskSchema` text index). Regex metacharacters change the match; an invalid pattern such
  as `a(` makes Mongo throw → unhandled 500.
- Project scope: same workspace-or-guest rule as dashboards, but archived projects are **not**
  excluded and `excludedMembers` is not honoured.
- `users` searches **all active users in the database**, not just workspace mates — any
  signed-in user can discover other tenants' names and emails.
- The UI ignores `sprints`.

---

## GET /api/activity

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `project` | id | requires a project role (403 otherwise) |
| `task` | id | filter by task |
| `user` | `me` | own activity |
| `page` | number | ≥ 1, default 1 |
| `limit` | number | default 30, max 100 |

### Behavior Notes
- Without `project`, the filter is forced to `user = me` — so `?task=X` alone returns only
  the caller's own entries for that task. (Task modal/journey get task activity from
  `GET /api/tasks/[id]` instead.)
- Populates `user`, `task` (key/title), `project` (name/key); sorted newest first.

### Response — 200
```ts
{ activity: Activity[]; total: number; page: number; pages: number }
```

---

## /api/filters

| Method | Behavior |
|---|---|
| GET `?project=` | my saved filters for that project **plus** global ones (`project: null`); without `project`, all mine |
| POST | body `{ name: 1–60, project?: id\|null, filters: Record<string, unknown> }` → 201 `{ filter }` |
| DELETE `?id=` | deletes `{ _id, user }`; 400 without `id` |

Used by the project filter bar in `src/components/project/common.tsx`. There is no RTK
mutation for DELETE, so the UI cannot delete a saved filter.

---

## /api/notifications

### GET
`?unread=1` returns only unread. Always newest 50, `actor` populated (name, avatarColor).
```ts
{ notifications: Notification[]; unreadCount: number }  // unreadCount ignores the 50 cap
```

### PATCH
Body `{ ids?: string[]; read?: boolean = true }`. Omitted/empty `ids` → applies to **all** of
my notifications. Always scoped to `user = me`. Returns `{ ok: true }`.

Creation is server-side only via `src/lib/apiHelpers.ts:notify` — see
[../17-notifications.md](../17-notifications.md).

---

## GET /api/users

- `?q=` regex on name/email; `?all=1` includes inactive users, honoured only for the super admin.
- Any authenticated user can list up to 100 active users across all workspaces
  (`-passwordHash` excluded). Same cross-tenant exposure as search `users`.

## PATCH /api/users/[id]

Super admin only (403 otherwise). Body `{ active?: boolean; designation?: string ≤ 80 }`.
400 when deactivating yourself; 404 unknown id. Logs `user.updated` activity (no project).
