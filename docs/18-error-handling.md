# 18 Error Handling

## Principle
This is a single-datastore transactional app, so errors are surfaced honestly — there is
no "one backend down, degrade to null" pattern. A failed request returns a real error
status and message; the UI shows loading/empty/error states.

## API Layer
- Validation failures → `422` with `{ error }` derived from zod issues.
- Auth → `401`; permission → `403`; not found → `404`; conflict → `409`.
- Unexpected failures → `500`. `logActivity`/`notify` failures are caught and logged so they
  never break the main mutation.
- Always return `{ error: string }` (never leak stack traces to the client).

## UI Layer
- `fetcher`/`api` in `src/lib/client.ts` throw on non-2xx; a `401` redirects to `/login`.
- Lists use SWR `isLoading` → `<Spinner/>`; empty results → `<EmptyState/>`.
- Mutations surface errors inline (form error text) or via `alert()` for quick actions;
  optimistic updates reconcile with `mutate()` after the request.

## States to Design For
| State | UI |
|---|---|
| Loading | `<Spinner label="…"/>` / SWR `keepPreviousData` on filter changes |
| Empty | `<EmptyState/>` with a directive hint and (often) a create action |
| Permission-denied | hide the control (client) **and** the server returns 403 |
| Not found / no access | 404 `{ error }`; page shows a message or redirects |
