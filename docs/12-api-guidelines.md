---
covers: ["src/lib/apiHelpers.ts", "src/lib/permissions.ts", "src/app/api/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 12 API Guidelines

## Layer Rules
- The API layer (`src/app/api/**`) is the **only** place that opens a DB connection or
  touches Mongoose models. UI never calls MongoDB directly.
- Every authenticated handler follows the same order:

```ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();          // 1. dbConnect + session user, or 401
  if (res) return res;
  const { id } = await params;                     //    Next 16: params is a Promise
  const task = await Task.findById(id);            // 2. load target → 404
  if (!task) return error("Task not found", 404);
  if (!(await can(user, String(task.project), "task:edit")))   // 3. capability → 403
    return error("You don't have permission to edit tasks", 403);
  const { data, res: bodyErr } = await parseBody(req, patchSchema); // 4. zod → 422 / 400
  if (bodyErr) return bodyErr;
  // 5. mutate, then logActivity(...) / notify(...)
  return json({ task });                           // 6. named-key envelope
}
```

Helpers in `src/lib/apiHelpers.ts`:

| Helper | Contract |
|---|---|
| `withAuth()` | `dbConnect()` then `requireUser()`; returns `{ user, res: null }` or `{ user: null, res: 401 "Unauthorized" }`. Inactive users count as unauthenticated. |
| `json(data, status = 200)` | `NextResponse.json(data, { status })` |
| `error(message, status = 400, extra?)` | `{ error: message, ...extra }` |
| `parseBody(req, schema)` | `schema.parse(await req.json())`; `ZodError` → **422** with `"path: message; …"`; unparsable JSON → **400** `"Invalid JSON body"` |
| `logActivity(entry)` | `Activity.create`; errors are logged and swallowed |
| `notify(entry)` | `Notification.create`; skips when `user === actor`; errors swallowed |

Permission helpers in `src/lib/permissions.ts`: `getProjectRole`, `getWorkspaceRole`,
`getCapabilities`, `can`, `isWorkspaceManager`, `isSuperAdmin`, `isWorkspaceExpired`,
`isProjectReadOnly`, `READ_ONLY_MESSAGE`. Model in [modules/04-roles-permissions.md](modules/04-roles-permissions.md).

## Route Conventions
- Collections: `GET`/`POST` on `/api/<domain>`; items: `GET`/`PATCH`/`DELETE` on `/api/<domain>/[id]`.
- Sub-resources: nested routes (`/api/tasks/[id]/comments`, `/api/projects/[id]/members`,
  `/api/projects/[id]/field-options`) or verb routes (`POST /api/tasks/reorder`, `PATCH /api/tasks/bulk`).
- Sub-resource deletes take the child id as a query param (`DELETE /api/workspaces/[id]/members?userId=`,
  `DELETE /api/projects/[id]/invites?inviteId=`, `DELETE /api/dashboards?id=`).
- Filtering/sorting/paging via query params. `GET /api/tasks`: `page` (default 1), `limit`
  (default 100, max 200), `sort`; `GET /api/activity`: `limit` default 30, max 100.
- Lifecycle transitions use an `action` field in the PATCH body (sprint `start`/`complete`/`archive`;
  invite `accept`/`reject`).
- `PATCH /api/workspaces/[id]` is dual-purpose: plan fields → super admin only; `name`/`description` → workspace owner/admin.
- Auth routes (`/api/auth/*`) don't use `withAuth`; see [api/auth.md](api/auth.md).

## Response Shape
Success returns the resource under a **named key** — there is no generic `{ data }` envelope:

```ts
{ task: {...} }                                   // item; POST returns 201
{ tasks: [...], total, page, pages }              // paged list
{ projects: [...] } / { sprints: [...] }          // unpaged list
{ notifications: [...], unreadCount }             // list + aggregate
{ ok: true }                                      // DELETE and fire-and-forget PATCHes
{ error: "human-readable message" }               // any 4xx/5xx
{ error: "...", detail: "<exception message>" }  // only auth login/register 500s
```

`GET /api/projects/[id]` and `GET /api/tasks/[id]` also return `myRole`, `myCapabilities`
and `readOnly` so the client can gate UI (`readOnly` = workspace plan/trial expired).

## Error Handling
| Status | When | Example |
|---|---|---|
| 400 | bad JSON, missing query param, invalid state transition | "Only a planned sprint can be started" |
| 401 | no/invalid session or inactive user (`withAuth`); bad Firebase token | "Unauthorized" |
| 403 | authenticated but lacks capability/role, or workspace read-only | "You don't have permission to edit tasks" |
| 404 | target missing — **or** hidden: project/workspace lookups return 404 when the caller has no role | "Project not found or access denied" |
| 409 | uniqueness/duplicate conflicts | "A project with key CC already exists in this workspace" |
| 422 | zod failure, or semantic validation (invalid status/type for project) | "Invalid status for this project" |
| 500 | unhandled exception (Next.js default response), or explicit in auth routes | — |

**403 vs 404.** Project- and workspace-scoped GETs hide existence (404 "… not found or access
denied"). Task-scoped routes load the task first, so a task in a project you can't see returns
**403 "Access denied"** — existence is revealed. Follow the surrounding domain's convention.

**Read-only (expired plan) 403s.** Two shapes:
- Workspace-level writes (`POST /api/projects`, `PATCH /api/workspaces/[id]` name/description,
  `POST`/`PATCH /api/workspaces/[id]/members`) check `isWorkspaceExpired()` and return
  403 with `READ_ONLY_MESSAGE`: "This workspace's trial/plan has expired — it is read-only until a plan is assigned".
- Project/task writes fail `can()` because capabilities collapse to `project:view`, so they
  return the generic "You don't have permission to …" 403. The UI explains the lock via `readOnly`.

See [18-error-handling.md](18-error-handling.md) for client handling.

## Documenting a Route
Every route domain gets a file in [`api/`](api/). Clone [`api/_TEMPLATE.md`](api/_TEMPLATE.md);
filled examples: [`api/auth.md`](api/auth.md), [`api/tasks.md`](api/tasks.md).
