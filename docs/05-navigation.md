# 05 Navigation Structure

## Top-level Routes
| Route | Screen | Purpose |
|---|---|---|
| `/` | redirect | → `/dashboard` |
| `/login`, `/register` | Auth | sign in / sign up (public) |
| `/dashboard` | Dashboard | configurable widgets across visible projects |
| `/my-tasks` | My Tasks | tasks assigned to / reported by the current user |
| `/workspaces` | Workspaces | list workspaces & projects; manage members & custom roles |
| `/profile` | Profile | user profile + recent activity |
| `/admin` | User admin | `super_admin` only: activate/deactivate, global roles |
| `/p/[projectId]/board` | Kanban board | drag & drop board (default project view) |
| `/p/[projectId]/backlog` | Backlog & Sprints | plan sprints, drag tasks, start/complete |
| `/p/[projectId]/list` | List/Table | sortable/groupable table with inline edit |
| `/p/[projectId]/calendar` | Calendar | tasks by due date |
| `/p/[projectId]/timeline` | Timeline | epics + children as a roadmap |
| `/p/[projectId]/reports` | Reports | velocity, burndown/burnup, distribution, flow, aging |
| `/p/[projectId]/activity` | Activity | project audit log |
| `/p/[projectId]/settings` | Settings | members, roles, statuses, labels, danger zone |

## Navigation Model
- **Left sidebar:** Dashboard / My Tasks / Workspaces, then a Projects list; the active
  project expands to its sub-views (board, backlog, list, calendar, timeline, reports,
  activity, settings).
- **Topbar:** global search (`⌘K` / `/`), theme toggle, notifications bell, user menu.
- **Task modal:** deep-linkable via `?task=<id>` on any project view.

## Deep-link Conventions
- Project views: `/p/[projectId]/<view>`.
- Open a task in context: `/p/[projectId]/board?task=[taskId]` (used by search & notifications).
- Workspaces are managed on `/workspaces` (no dedicated `/w/[id]` page in V1).
