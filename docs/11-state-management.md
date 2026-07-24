# 11 State Management

## Server State
- Fetched with **SWR** against `/api/**` (`fetcher` in `src/lib/client.ts`).
- `useProject(projectId)` returns `{ project, myRole, myCapabilities, mutate }`.
- App-wide context (`AppShell`) provides `me`, `workspaces`, `projects`, and a `refresh()`.
- Mutations call `api()` then `mutate()` to revalidate; some flows update the SWR cache
  optimistically first (board/backlog drag & drop) and revalidate after.

## Client State
- Local UI state via `useState` (modals open, filters, selection, inline-edit buffers).
- No global client store (no Redux/Zustand) — server state + small local state is enough.
- Cross-cutting values (current user, projects, workspaces) come from `AppCtx`/`useApp()`.

## Persistence
- **Session:** httpOnly cookie `sm_session` (JWT) — not readable by JS.
- **Theme:** `localStorage.sm_theme`.
- **Deep-link/URL state:** `?task=<id>` opens the task modal on any project view.
- **Saved filters / dashboards:** persisted server-side (`SavedFilter`, `Dashboard` models).

## Rules
- Prefer server state; lift to client state only for interactivity.
- Optimistic updates must reconcile via `mutate()` — never leave the cache diverged on error.
- Do not cache permission decisions on the client for security; re-checked on every API call.
