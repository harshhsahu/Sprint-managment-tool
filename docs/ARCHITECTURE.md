# System Architecture — SprintBoard

## Overview

SprintBoard is a transactional agile task-management app (Jira/Linear-style) built on
Next.js 16 (App Router) with a single MongoDB datastore accessed through Mongoose. The
browser talks only to `/api/**` route handlers; those handlers authenticate the request,
enforce capability-based permissions, validate the body with zod, and read/write MongoDB.

---

## Integration Strategy

There is a single backend (MongoDB). The seam that keeps the UI decoupled from the data
layer is the **API route layer** — UI never imports models directly.

1. **Phase 1 (current):** Single MongoDB via Mongoose; all access behind `/api/**`.
2. **Phase 2 (future):** If a service is extracted (e.g. notifications, reporting), it
   sits behind the same `/api/**` contract — UI components do not change.

Key invariant: **UI components never open a DB connection.** They call the API layer with
SWR; swapping or splitting the datastore only touches route handlers + `src/models`.

---

## Client Layer

- **Framework:** Next.js 16 App Router (React 19)
- **Styling:** Tailwind CSS v4 (+ shared classes in `globals.css`)
- **UI Library:** none — bespoke components in `src/components` (icons via `lucide-react`)
- **Data Fetching:** SWR against `/api/**`; mutations via `api()` helper in `src/lib/client.ts`
- **Interactivity:** client components for board/backlog DnD (`@hello-pangea/dnd`), modals, inline edit

---

## Backend / API Layer

The API layer is a set of Next.js route handlers under `src/app/api/**`. Each handler:

1. `withAuth()` — connect to DB + resolve the session user (401 if missing/inactive).
2. Permission check — `getWorkspaceRole` / `getProjectRole` / `can(user, projectId, cap)`.
3. `parseBody(req, zodSchema)` — validate input (422 on failure).
4. Read/write Mongoose models; write an `Activity` audit entry and `Notification`s where relevant.
5. Return `{ resource }` (2xx) or `{ error }` (4xx/5xx).

### Core System

1. **MongoDB** (`src/lib/db.ts` → cached Mongoose connection, models in `src/models/index.ts`)
   - **Role:** source of truth for all entities (users, workspaces, projects, sprints, tasks, comments, activity, notifications, dashboards, saved filters).
   - **Auth:** connection string in `MONGODB_URI`.
   - **Access posture:** read/write; a single cached connection reused across route handlers.

See [`current-infrastructure/mongodb.md`](current-infrastructure/mongodb.md) for the deep detail.

---

## Security Model

1. **Access control:** JWT session in an httpOnly cookie (`sm_session`), signed with
   `JWT_SECRET` via `jose`. `src/middleware.ts` redirects unauthenticated users to `/login`.
2. **Secrets never leak:** `JWT_SECRET` and `MONGODB_URI` are read only in server code.
3. **Least privilege:** capability-based RBAC; every mutating route checks a specific
   capability. Visibility is scoped to workspaces/projects the user belongs to.
4. **Write isolation:** all mutations go through `/api/**` handlers that re-check the
   session and capability on every request — the client is never trusted.
