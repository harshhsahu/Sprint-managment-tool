---
covers: ["src/store/**", "src/components/AppShell.tsx", "src/components/project/common.tsx", "src/app/layout.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 11 State Management

> The README and older docs say "SWR". That is stale: since `9b332de` (2026-07-28) all
> server state lives in **RTK Query** inside a Redux store. `swr` is still in
> `package.json` and `src/lib/client.ts` still exists, but nothing imports either.

## Server State

**Store wiring.** `src/store/store.ts:makeStore` configures one reducer (`api.reducerPath`)
+ `api.middleware`, and calls `setupListeners` (refetch on focus/reconnect).
`src/store/Providers.tsx` wraps `<body>` in `src/app/layout.tsx`. The store is a module
singleton (`store`), not per-request.

**API slice** — `src/store/api.ts:api` (`createApi`, `fetchBaseQuery({ baseUrl: "" })`):
- Most queries are **keyed by the full request URL** (`getTasks("/api/tasks?project=…")`),
  so the cache key equals the old SWR key. `getTask`, `getProject` take an id.
- The base query redirects to `/login?next=<path+query>` on any 401.
- `errMsg(e)` extracts `data.error` (+ `(detail)` when the server sent one) for display.

**Reading** — `src/store/hooks.ts:useQ` wraps each query hook in `useSwrLike`, returning
SWR's `{ data, isLoading, mutate }` shape:

| Behaviour | How |
|---|---|
| Conditional fetch | pass `null`/`undefined` → `skipToken` |
| keepPreviousData | last non-undefined `data` kept in state while a new arg loads; `isLoading` only true when nothing is shown |
| `mutate()` | is RTK `refetch` — it refetches, it does **not** accept new data |
| Polling | `useQ.useNotifications` / `useInvites` with `{ pollingInterval: 30000 }` (AppShell); `useDashboardData` with `60000` (dashboard) |

**Tags & invalidation.** Tag types: `Tasks`, `Task`, `Projects`, `Project`, `Sprints`,
`Workspaces`, `Users`, `Me`, `Notifications`, `Invites`, `Activity`, `Dashboards`,
`Filters`, `ProjectInvites`, `Reports`, `Search`.

| Mutation group | Invalidates |
|---|---|
| task create/delete/duplicate/bulk | `Tasks` |
| `updateTask` | `{Task, id}`, `Tasks` |
| `addComment` | `{Task, id}` |
| sprint create/update/delete | `Sprints`, `Tasks` |
| workspace create/delete | `Workspaces`, `Projects` |
| `updateWorkspace` (rename/describe) | `Workspaces`, `Projects`, all `Project` |
| workspace member invite/update/remove, `setWorkspacePlan` | `Workspaces` |
| `updateProject` | `{Project, id}`, `Projects`; member ops → `{Project, id}` |
| `respondInvite` | `Invites`, `Notifications`, `Projects` |
| `reorderTasks`, auth mutations | nothing (callers patch the cache) |

Not tagged: `getSearch`, `getDashboardData` (dashboard relies on 60 s polling).

**Optimistic updates** (UI-first; roll back with `patch.undo()` on failure):

| Where | Patch |
|---|---|
| `updateTask` `onQueryStarted` | patches `getTask(id)`; **skips** reference fields (`assignee`, `sprint`, `epic`, `dependencies`, `watchers`, `parentTask`, `reporter`) because GET returns populated objects; merges `customFields` |
| `setWorkspacePlan` | patches `getWorkspacesList("/api/workspaces?all=1")` so admin `<select>`s don't snap back |
| Board / backlog / list pages | `api.util.updateQueryData("getTasks", <exact url>, …)` before `reorderTasks` / `updateTask` |

**Shared context.** `src/components/AppShell.tsx:useApp` exposes `me`, `workspaces`,
`projects`, `refresh()` (refetch workspaces + projects). `src/components/project/common.tsx:useProject`
returns `{ project, myRole, myCapabilities, readOnly, mutate }` from `GET /api/projects/[id]`.

## Client State
- Local UI state via `useState` (modals, filters, selection, inline-edit buffers, dashboard draft).
- No client slices in Redux — the store holds only the RTK Query cache.
- Board/list/backlog filters are component state, not URL state (lost on reload).

## Persistence
- **Session:** httpOnly cookie `sm_session` (JWT, 7 d) — not readable by JS. Firebase keeps its own client session.
- **Theme:** `localStorage.sm_theme` (`"dark"`/`"light"`), applied pre-paint by an inline script in `src/app/layout.tsx`.
- **URL state:** only `?task=<id>` on the board, and `?next=` on `/login`.
- **Saved filters / dashboards:** server-side (`SavedFilter`, `Dashboard` models).

## Rules
- Prefer server state; lift to client state only for interactivity.
- `updateQueryData` must use the **exact** cache key the view subscribed with (same URL
  string incl. filters) — a different string patches nothing, silently.
- Optimistic patches must `undo()` on failure; never leave the cache diverged.
- On sign-out dispatch `api.util.resetApiState()` (done in `AppShell` `Topbar`) — the
  store is a singleton, so cached data otherwise survives a user switch (fixed in `79ab40a`).
- `readOnly` / `myCapabilities` on the client are for UX only; the server re-checks every call.
