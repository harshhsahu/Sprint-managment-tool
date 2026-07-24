# 13 Security

## Access Control
- **Authentication:** email + password (bcrypt hash). On login a JWT is signed with `jose`
  and stored in an httpOnly, SameSite=Lax cookie `sm_session` (7-day expiry).
- **Route gating:** `src/middleware.ts` verifies the JWT and redirects unauthenticated
  users to `/login`; API handlers re-verify via `withAuth()` (never trust the client).
- **Authorization (RBAC):** capability-based. One role set — **owner/admin/editor/viewer** —
  applies at both the workspace and project level and resolves to a capability set
  (`project:view`, `task:create|edit|delete|comment`, `sprint:manage`, `member:manage`,
  `project:manage`). `super_admin`/`member` are separate GLOBAL roles for user
  administration only. See [modules/04-roles-permissions.md](modules/04-roles-permissions.md).
- **Enforcement:** `can(user, projectId, capability)` in every mutating route. UI gating on
  `myCapabilities` is UX only.

## Access & Visibility
- A workspace member has their role on **every project** in the workspace (computed — not
  copied into `project.members`). `project.members` holds only **guests** (users outside
  the workspace granted single-project access).
- Users only see workspaces/projects they belong to (member or guest). `super_admin` does
  **not** auto-see other users' data. All list queries filter by workspace membership +
  guest entries. Removing someone from a workspace revokes their access to all its projects.

## Secrets
- `JWT_SECRET` and `MONGODB_URI` live in env (`.env.local` locally; Cloud Run env/Secret
  Manager in prod). Read only in server code; never sent to the browser.
- Server-only clients (`db`, `models`, `auth`) are never imported into client components.

## Data Access
- Single Mongoose connection, cached and reused. All access mediated by API handlers.
- Compound unique indexes prevent duplicates (e.g. `{ workspace, key }` on projects,
  `{ project, key }` on tasks).

## Input Handling
- Every request body validated with zod (`parseBody`). Unknown roles/statuses are rejected (422).
- Mongoose schema types + enums constrain writes; user text (titles, comments) stored as-is
  and rendered as text (no `dangerouslySetInnerHTML` for user content).

## Threat Model Notes
- Sensitive surface: cross-tenant data exposure (mitigated by strict visibility scoping),
  privilege escalation (mitigated by server-side capability checks), and session theft
  (httpOnly cookie, signed JWT).
- Passwords never logged or returned (`select("-passwordHash")` on user reads).
