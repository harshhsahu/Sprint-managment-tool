# AI Agent Guidelines (Kanbo)

Rules and heuristics for AI coding agents working in the `sprint-management` repository.
Read this carefully before generating or modifying any code. These rules override
default agent behavior.

> This is the **project-specific** rulebook. The repo-root [`AGENTS.md`](../AGENTS.md) is
> the short universal version; this file is where the sharp constraints live.

## 1. Architecture / Integration Phase

Kanbo is a **fully-integrated transactional CRUD app** over a single MongoDB
database (via Mongoose). There is no mock layer and no multi-backend aggregation.

- UI components (client) fetch through the API layer only, using SWR against `/api/**`.
- The API route handlers (`src/app/api/**`) are the **only** code that opens a DB
  connection or touches Mongoose models.
- **Do NOT** import Mongoose models or `dbConnect` into client components — they are
  server-only and would break the client bundle and leak the connection string.

## 2. Server vs Client Boundaries

- The app uses the Next.js App Router. Route handlers under `src/app/api/**` are the
  server layer; pages under `src/app/(app)/**` and `src/app/(auth)/**` are mostly
  **client components** (`"use client"`) because the UI is highly interactive (drag &
  drop, modals, inline editing).
- Server-only modules: [`src/lib/db.ts`](../src/lib/db.ts), [`src/models/index.ts`](../src/models/index.ts),
  [`src/lib/auth.ts`](../src/lib/auth.ts), [`src/lib/permissions.ts`](../src/lib/permissions.ts),
  [`src/lib/apiHelpers.ts`](../src/lib/apiHelpers.ts). **Never** import these into a client component.
- `JWT_SECRET` and `MONGODB_URI` are read only in server code. They must never reach the browser.

## 3. Tech Stack Restrictions

One approved library per concern. Adding a second is a review-blocking change.

- **Styling:** Tailwind CSS v4 — utility classes + a few shared classes in
  [`globals.css`](../src/app/globals.css) (`.input`, `.btn-*`, `.card`, `.chip`). No CSS-in-JS.
  Tailwind v4 does **not** allow `@apply`-ing custom (non-utility) classes.
- **Icons:** `lucide-react` only.
- **Charts:** `recharts` only.
- **Drag & drop:** `@hello-pangea/dnd` only.
- **Data fetching (client):** `swr` only.
- **Validation:** `zod` for every API request body.
- **Auth/crypto:** `jose` (JWT) + `bcryptjs` (password hashing).

## 4. Roles & Capabilities

One role set — **owner > admin > editor > viewer** — is used at both the workspace and
project level (see [`src/lib/constants.ts`](../src/lib/constants.ts)):

- **owner**: full control incl. deleting the workspace/project (the creator).
- **admin**: manage members, settings, sprints, and all task actions.
- **editor**: create / edit / comment on tasks (NO delete, NO sprint management).
- **viewer**: read-only.

Roles resolve to capabilities (`project:view`, `task:create|edit|delete|comment`,
`sprint:manage`, `member:manage`, `project:manage`). **Enforce with `can()` /
`getCapabilities()`**, never role-name string checks. Client UI gates on `myCapabilities`
(returned by the project/task GET routes). There is no custom-role builder — the four
roles are the whole set.

## 5. Access Model (workspace grants all projects)

- A **workspace member** (owner/admin/editor/viewer) automatically has that role on
  **every project** in the workspace. Do NOT copy them into `project.members`.
- `project.members` holds only **guests** — users NOT in the workspace who were given
  access to a single project (role admin/editor/viewer).
- `getProjectRole` = workspace role (if a workspace member) ELSE the project-guest role.
- Visibility is scoped: users only reach workspaces/projects they belong to. `super_admin`
  is a **global** role for the user-administration page only — it does NOT grant access to
  other users' workspaces. Every list query filters by workspace membership + guest
  entries. See [`13-security.md`](13-security.md) and [`modules/04-roles-permissions.md`](modules/04-roles-permissions.md).

## 6. Error Handling (single DB, not fail-soft-to-null)

This is a single-datastore app, so an API failure is a real error, not a degraded block.

- On success, routes return the resource under a named key: `{ tasks }`, `{ task }`,
  `{ project }`, `{ workspace }`, etc.
- On failure, return `{ error: string }` with an appropriate status (`400/401/403/404/409/422/500`).
- The client ([`src/lib/client.ts`](../src/lib/client.ts)) throws on non-2xx and redirects to `/login` on 401.
- UI must render loading / empty / error states (see [`18-error-handling.md`](18-error-handling.md)).

## 7. Task Keys & Numbering

Tasks are identified by a human-readable **key** like `CC-42`, built from the project's
`key` prefix + a per-project incrementing `taskCounter`. See
[`modules/03-tasks.md`](modules/03-tasks.md). Never renumber existing keys.

## 8. Modifying Documentation

If you learn something new about the data model, or change an API/data contract, you
**must** update the corresponding file in [`api/`](api/), [`database/`](database/),
[`modules/`](modules/), or [`current-infrastructure/`](current-infrastructure/) in the
same change. The docs are the source of truth.
