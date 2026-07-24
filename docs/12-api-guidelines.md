# 12 API Guidelines

## Layer Rules
- The API layer (`src/app/api/**`) is the **only** place that opens a DB connection or
  touches Mongoose models. UI never calls MongoDB directly.
- Every handler: `withAuth()` → permission check → `parseBody(zod)` → model I/O →
  `logActivity`/`notify` → JSON.

## Route Conventions
- Collections: `GET`/`POST` on `/api/<domain>` (e.g. `/api/tasks`).
- Items: `GET`/`PATCH`/`DELETE` on `/api/<domain>/[id]`.
- Sub-actions: nested routes (`/api/tasks/[id]/comments`, `/api/tasks/[id]/duplicate`) or a
  verb route (`/api/tasks/reorder`, `/api/tasks/bulk`).
- Filtering/sorting/pagination via query params (`?project=&status=&sort=&page=&limit=`).
- Lifecycle transitions use an `action` field in the PATCH body (e.g. sprint `start`/`complete`/`archive`).

## Response Shape
Success returns the resource under a named key (not a generic `{ data }` envelope):

```ts
// success
{ task: {...} }                 // or { tasks, total, page, pages } for lists
// error
{ error: "human-readable message" }   // with HTTP status 400/401/403/404/409/422/500
```

`GET /api/projects/[id]` and `GET /api/tasks/[id]` also return `myRole` and
`myCapabilities` so the client can gate UI correctly (including custom roles).

## Error Handling
- Validation → `422` with a message from zod issues.
- Auth → `401`; permission → `403`; missing → `404`; conflict (e.g. duplicate key) → `409`.
- This is a single datastore: a DB failure is a real `500`, not a silent `null`. See
  [18-error-handling.md](18-error-handling.md).

## Documenting a Route
Every route domain gets a file in [`api/`](api/). Clone [`api/_TEMPLATE.md`](api/_TEMPLATE.md);
see the filled examples [`api/auth.md`](api/auth.md) and [`api/tasks.md`](api/tasks.md).
