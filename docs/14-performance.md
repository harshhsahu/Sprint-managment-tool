# 14 Performance

## Budgets
- Perceived board/list interaction < 150 ms (optimistic updates absorb network latency).
- List/board queries capped (`limit` up to 200; default 50–100) and paginated.

## Fetching Strategy
- SWR with `keepPreviousData` on filtered lists to avoid fl/ empty flashes when filters change.
- Dashboard aggregates come from a single `/api/dashboards/data` call (one round-trip for
  all widgets) with a 60s `refreshInterval`; notifications poll every 30s.
- Reports compute server-side from the minimal fields needed (`.select(...)`).

## Rendering
- Interactive views are client components; charts (`recharts`) render in `ResponsiveContainer`.
- Optimistic DnD updates the SWR cache immediately, then reconciles on revalidate.
- Production image uses Next.js `output: "standalone"` for a small, fast-booting container.

## Indexing (MongoDB)
- `User.email` unique; `Project {workspace, key}` unique; `Task {project, key}` unique.
- Task indexes on `project`, `status`, `priority`, `assignee`, `sprint`, `archived`, plus a
  text index on `title/description/key` for search. See
  [`current-infrastructure/mongodb.md`](current-infrastructure/mongodb.md).

## Known Hot Paths
- **Dashboard data & reports** iterate over a project's tasks in memory — fine at team
  scale; if projects grow very large, push aggregation into MongoDB `$group` pipelines.
- **Reorder** uses fractional `order` values (midpoint between neighbors) to avoid
  renumbering the whole column on every drag.
