# 03 User Personas

## Engineering Manager / Workspace Admin
- **Role:** owns a workspace, creates projects, manages members and custom roles.
- **Goals:** keep teams organized, see cross-project health, control access.
- **Pain points:** access sprawl, not knowing who's overloaded, tool admin overhead.
- **How this product helps:** workspaces, capability-based roles, dashboards, workload widgets.
- **Access level:** `workspace_admin` (workspace) → `project_admin` on its projects.

## Team Lead / Scrum Master
- **Role:** runs sprints for a project.
- **Goals:** plan the backlog, start/complete sprints, track burndown and velocity.
- **Pain points:** manual sprint bookkeeping, scope creep, stale tasks.
- **How this product helps:** backlog planning, sprint lifecycle, velocity/burndown/aging reports.
- **Access level:** `team_lead` — `sprint:manage` + all task capabilities.

## Developer / QA
- **Role:** does the work — picks up tasks, moves them across the board, comments.
- **Goals:** see what's assigned, update status quickly, raise/close bugs.
- **Pain points:** slow UIs, too many clicks to update a task.
- **How this product helps:** Kanban DnD, inline edit, quick create, My Tasks, @mentions.
- **Access level:** `developer` / `qa` — create/edit/comment on tasks (no delete, no settings).

## Stakeholder / Viewer
- **Role:** watches progress without changing anything.
- **Goals:** understand status, upcoming deadlines, sprint progress.
- **Pain points:** being handed screenshots instead of a live view.
- **How this product helps:** read-only access, dashboards, reports.
- **Access level:** `viewer` — `project:view` only.
