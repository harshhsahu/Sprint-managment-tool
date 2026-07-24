# 03 User Personas

> Access uses one role set — **owner / admin / editor / viewer** — applied at the workspace
> level (grants access to all projects) or as a per-project guest.

## Owner (workspace creator)
- **Role:** owns a workspace, creates projects, manages members, controls everything.
- **Goals:** keep teams organized, see cross-project health, control access.
- **How this product helps:** workspaces, dashboards, workload widgets, full settings.
- **Access level:** `owner` — every capability, incl. deleting the workspace/project.

## Admin
- **Role:** runs the workspace/projects day to day — members, settings, sprints.
- **Goals:** plan sprints, manage the team, keep projects configured.
- **How this product helps:** member management, sprint lifecycle, all reports.
- **Access level:** `admin` — everything except deleting the workspace (owner-only).

## Editor (developer / QA)
- **Role:** does the work — picks up tasks, moves them across the board, comments.
- **Goals:** update status quickly, raise/close bugs, collaborate.
- **How this product helps:** Kanban DnD, inline edit, quick create, My Tasks, @mentions.
- **Access level:** `editor` — create/edit/comment on tasks (no delete, no sprint/settings).

## Viewer (stakeholder)
- **Role:** watches progress without changing anything.
- **Goals:** understand status, upcoming deadlines, sprint progress.
- **How this product helps:** read-only dashboards and reports.
- **Access level:** `viewer` — `project:view` only.
