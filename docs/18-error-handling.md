---
covers: ["src/lib/apiHelpers.ts", "src/store/api.ts", "src/app/api/**", "src/components/**", "src/app/(app)/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 18 Error Handling

## Principle
Single-datastore transactional app: errors are surfaced honestly — there is no
"one backend down, degrade to null" pattern. A failed request returns a real status and
`{ error }`; the UI shows loading/empty/error states or rolls back an optimistic change.

## API Layer
- Status codes and the 403-vs-404 convention: [12-api-guidelines.md](12-api-guidelines.md#error-handling).
- Validation → 422 with `"path: message; …"` from zod issues (`parseBody`); bad JSON → 400.
- Read-only (expired plan) → 403 with `READ_ONLY_MESSAGE` on workspace-level writes; generic
  "You don't have permission to …" 403 on project/task writes.
- `logActivity` / `notify` catch and `console.error` their own failures so they never break the main mutation.
- Most handlers have **no try/catch**. An unexpected throw (DB down, Mongoose CastError
  from a malformed id — no handler validates ObjectIds) becomes Next.js's default 500, which is
  not `{ error }` JSON. `errMsg()` then falls back to "Request failed"/the RTK error string.
- Exceptions: `POST /api/auth/login` and `POST /api/auth/register` wrap everything and return
  `500 { error, detail }` where `detail` is the raw exception message (in-code note:
  "Remove/gate once prod is stable"). See [13-security.md](13-security.md).

> [!WARNING]
> Never add `detail`/stack output to other routes; `errMsg()` will show it to end users verbatim.

## UI Layer
- **401 anywhere** → `src/store/api.ts` base query redirects to `/login?next=<path+query>`
  (skipped when already on `/login` or `/register`).
- **Reading errors:** `useQ` hooks expose only `{ data, isLoading, mutate }` — the query
  `error` is dropped. A failed GET therefore looks like "still loading" or "empty"; pages
  don't render an error state. Typical guards: `if (!project) return <Spinner/>`.
- **Mutation errors:** `await trigger(args).unwrap()` in `try/catch`, then either inline form
  text (`setErr(errMsg(e))`) or `alert(errMsg(e))` for quick actions (board quick-add,
  backlog sprint actions, bulk bar, admin, custom-field options).
- **Optimistic updates** roll back with `patch.undo()` in `catch` — board/backlog drags and
  list inline edits do this **silently** (no message).
- `TaskModal` field edits (`patch()`) have no `catch`: failure = silent rollback + unhandled rejection.
- No `error.tsx`, `global-error.tsx`, `not-found.tsx` or `loading.tsx` exist — a render-time <!-- verify:ignore -->
  exception shows Next.js's default error screen.

## States to Design For
| State | UI |
|---|---|
| Loading | `<Spinner label="…"/>`; `useQ` keeps previous data on filter/page changes |
| Empty | `<EmptyState/>` with a directive hint and (often) a create action |
| Permission-denied | hide/disable the control via `myCapabilities` (client) **and** server 403 |
| Read-only workspace | `ProjectHeader` red banner + disabled controls (`readOnly`), `PlanBadge` "Expired · read-only" |
| Not found / no access | API 404/403 `{ error }`; page usually stays on its spinner (see above) |
| Optimistic failure | rollback; message only where the call site added `alert`/inline text |
