---
covers: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/AppShell.tsx", "src/middleware.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 05 Navigation Structure

## Top-level Routes
| Route | Screen | Purpose |
|---|---|---|
| `/` | Landing | public marketing page (server component); "Go to app" CTA when signed in |
| `/login`, `/register`, `/forgot-password` | Auth | Firebase sign-in / sign-up / reset (public; signed-in users are redirected to `/dashboard`) |
| `/dashboard` | Dashboard | configurable widgets across visible projects |
| `/my-tasks` | My Tasks | tasks assigned to / reported by the current user |
| `/workspaces` | Workspaces | list workspaces & projects; members; workspace settings modal (rename/describe) |
| `/profile` | Profile | user profile + recent activity |
| `/admin` | Administration | super-admin email only: plans & subscriptions table, user administration |
| `/p/[projectId]/board` | Kanban board | drag & drop board (default project view); handles `?task=` |
| `/p/[projectId]/backlog` | Backlog & Sprints | plan sprints, drag tasks, start/complete |
| `/p/[projectId]/list` | List/Table | sortable/groupable table with inline edit |
| `/p/[projectId]/calendar` | Calendar | tasks by due date |
| `/p/[projectId]/timeline` | Timeline | epics + children as a roadmap |
| `/p/[projectId]/reports` | Reports | velocity, burndown/burnup, distribution, flow, aging, done calendar; task journey modal |
| `/p/[projectId]/activity` | Activity | project audit log |
| `/p/[projectId]/settings` | Settings | general, team access, guests, statuses, task types, task fields, archived tasks, danger zone |

## Navigation Model
- **Left sidebar** (`src/components/AppShell.tsx:Sidebar`): Dashboard / My Tasks / Workspaces,
  then a Projects list; the active project (matched by `/p/<24-hex id>`) expands to its 8
  sub-views. Theme toggle at the bottom. Starts collapsed below 1024 px; never auto-closes on navigation.
- **Topbar** (`Topbar`): open-sidebar button, Back (`router.back()`), global search
  (`/` or `⌘K`/`Ctrl+K`), `PlanBadge` for the active project's workspace, notifications bell
  (notifications + pending project invites, polled every 30 s), user menu (Profile,
  User administration for super admin, Sign out).
- **Sign out** clears Firebase, calls `POST /api/auth/logout`, then `api.util.resetApiState()`
  so the next user never sees cached data.
- **Task modal:** opens in place from any project view (local state); only the board reads `?task=<id>`.

## Deep-link Conventions
- Project views: `/p/[projectId]/<view>`.
- Open a task: `/p/[projectId]/board?task=[taskId]` — used by search, notifications,
  dashboard widgets and TaskModal's "Copy link". Closing the modal `router.replace`s back to
  `/p/[projectId]/board`. Other views (list, backlog, …) ignore `?task=`.
- Auth redirect: middleware sends anonymous users to `/login?next=<path>`; login pushes to
  `next` (or `/dashboard`). Client-side 401s do the same with path + query
  (`src/store/api.ts` `redirectToLogin`).
- Workspaces are managed on `/workspaces` (no `/w/[id]` page).
