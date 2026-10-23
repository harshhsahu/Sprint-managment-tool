---
covers: ["src/lib/constants.ts", "src/lib/permissions.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 03 User Personas

> Access uses one role set — **owner / admin / editor / viewer** — applied at the workspace
> level (grants access to all projects) or as a per-project **guest**. Capability matrix and
> enforcement: [modules/04-roles-permissions.md](modules/04-roles-permissions.md).
> The ICP these personas belong to (small Indian software teams) is in [01-product-vision.md](01-product-vision.md).

> [!TODO]
> These personas are derived from the role model in code, not from user research. Real persona
> goals and frustrations need a human.

## Owner (workspace creator, usually the buyer)
- **Role:** creates the workspace, invites the team, creates projects; the person whose trial converts to a plan.
- **Goals:** keep teams organized, see cross-project health, control access and cost.
- **How this product helps:** workspaces, owner/lead dashboard template, full settings, plan badge with days left.
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
- **How this product helps:** read-only boards, dashboards and reports.
- **Access level:** `viewer` — `project:view` only.

## Project guest (e.g. a client)
- **Role:** someone outside the workspace given access to a single project (`project.members`).
- **Access level:** admin/editor/viewer on that one project only.

## Super admin (Kanbo operator)
- **Role:** the single operator account (`SUPER_ADMIN_EMAIL`) that manages users and assigns plans in `/admin`.
- **Access level:** global user administration; no automatic access to workspaces it isn't a member of.
