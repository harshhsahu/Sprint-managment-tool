---
covers: ["src/store/**", "src/app/(app)/dashboard/page.tsx", "src/app/api/dashboards/data/route.ts", "src/app/api/reports/**", "src/app/api/search/route.ts", "src/app/api/tasks/route.ts", "src/models/index.ts", "next.config.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 14 Performance

## Budgets
> [!TODO]
> No numeric budgets (latency, bundle size, Web Vitals) are defined in code, CI or monitoring.
> The previous "< 150 ms perceived interaction" figure had no source. Targets need a human.

Observed mitigations:
- Drag & drop, list inline edits and task-field edits are optimistic, so perceived latency ≈ 0.
- Task lists are capped: `GET /api/tasks` `limit` default 100, max 200. Board, backlog,
  timeline, calendar and archived-tasks request `limit=200` with **no paging** — a project
  with more than 200 matching tasks silently shows only the first 200. Only the list view pages (`limit=50`).

## Fetching Strategy
- RTK Query dedupes identical keys: components asking for the same URL share one request
  (e.g. `useProject` is called by the page, `ProjectHeader` and `BulkBar`).
- `src/store/hooks.ts:useQ` keeps the previous result while a new key loads (filter/page
  changes don't flash a spinner).
- Polling uses RTK Query `pollingInterval` (older docs said SWR refreshInterval — gone):
  - notifications + invites: 30 s (`src/components/AppShell.tsx:NotificationsBell`), on every app page;
  - dashboard data: 60 s, **per widget** — each `Widget` calls `useQ.useDashboardData(query)` with
    its own effective filters; widgets with identical queries share one cache entry, the page
    fetches once more for filter options.
- Refetch on window focus/reconnect is enabled via `setupListeners` in `src/store/store.ts`.
- Reports and dashboard routes project only needed fields with `.select(...)`.

## Rendering
- Interactive views are client components; charts (`recharts`) only on dashboard and reports.
- `lucide-react` is rewritten to per-icon imports (`experimental.optimizePackageImports`, `90fc712`).
- Production image uses `output: "standalone"` for a small, fast-booting Cloud Run container.
- `next build` skips type-check (memory; see `next.config.ts` comment).

## Indexing (MongoDB)
- Unique: `User.email`; `Project {workspace, key}`; `Task {project, key}`.
- Single-field: `Task.project`, `key`, `status`, `priority`, `assignee`, `sprint`, `archived`;
  `User.firebaseUid` (sparse); `Activity.project/workspace/task` + `{createdAt: -1}`;
  `Notification.user`, `read`; `Invite.project`, `email`, `status`; per-user `SavedFilter`/`Dashboard`.
- A text index on `Task {title, description, key}` exists but **nothing uses `$text`**:
  `GET /api/search` and `GET /api/tasks?q=` use case-insensitive `$regex` (collection scan
  within the project filter). Details: [current-infrastructure/mongodb.md](current-infrastructure/mongodb.md).

## Known Hot Paths
- **Permission checks are uncached DB reads.** Every `can()` → `getCapabilities` →
  `getProjectRole` (Project + Workspace reads) + `isProjectReadOnly` (Project + Workspace reads
  again). GET project/task call `getProjectRole`, `getCapabilities` and `isProjectReadOnly`
  separately → ~6–8 small queries per request.
- **Dashboard data & reports** load a project's tasks and aggregate in memory — fine at team
  scale; move to `$group` pipelines if projects get large.
- **Reorder / bulk** loop `logActivity` + `notify` with sequential `await`s per task.
- **Reorder** uses fractional `order` (midpoint between neighbours) to avoid renumbering a column.
- **Board status drag** issues `POST /api/tasks/reorder` then a redundant `PATCH /api/tasks/[id]`
  (see [07-system-architecture.md](07-system-architecture.md#data-flow)).
