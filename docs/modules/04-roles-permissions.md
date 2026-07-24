# Module: Roles, Access & Permissions

> Capability-based RBAC. Server logic in [`src/lib/permissions.ts`](../../src/lib/permissions.ts);
> roles/capabilities in [`src/lib/constants.ts`](../../src/lib/constants.ts).

## Purpose
Control who can reach what, and what they can do, with one simple role set applied at both
the workspace and project level.

## The four roles
| Role | Can do |
|---|---|
| **Owner** | Everything, incl. deleting the workspace/project. The creator; exactly one. |
| **Admin** | Manage members, settings, sprints, and all task actions. |
| **Editor** | Create, edit, and comment on tasks. No delete, no sprint management. |
| **Viewer** | Read-only. |

The same vocabulary is used for workspace membership and for project guests.

## Access model — workspace grants all projects
- **Workspace members** (owner/admin/editor/viewer) automatically have that role on
  **every project** in the workspace. There is no per-project invite. They are NOT stored
  in `project.members`.
- **Project guests** are users who are NOT workspace members but have been given access to
  a **single** project (stored in `project.members`, role admin/editor/viewer). They can
  only reach that one project.
- A guest cannot be someone who is already a workspace member (the API rejects it 409 —
  they already have access everywhere).

## Resolution & enforcement
- `getWorkspaceRole(user, ws)` → owner (owner field) / member role / null.
- `getProjectRole(user, project)` → the user's **workspace role** if they're a workspace
  member (grants all projects), otherwise their **project-guest role**, otherwise null.
- `getCapabilities()` maps the role to a capability set (`ROLE_CAPS`); `can(user, pid, cap)`
  gates every mutating route. `GET /api/projects/[id]` and `GET /api/tasks/[id]` return
  `myCapabilities` so the UI hides controls the user can't use. **Client gating is UX only.**

## Capabilities
`project:view` · `task:create` · `task:edit` · `task:delete` · `task:comment` ·
`sprint:manage` · `member:manage` · `project:manage`.

| Capability | owner | admin | editor | viewer |
|---|---|---|---|---|
| project:view | ✓ | ✓ | ✓ | ✓ |
| task:create / edit / comment | ✓ | ✓ | ✓ | |
| task:delete | ✓ | ✓ | | |
| sprint:manage | ✓ | ✓ | | |
| member:manage / project:manage | ✓ | ✓ | | |

## Where roles are managed (UI)
- **Workspace members** — Workspaces page → **Members** modal (owner locked; others
  admin/editor/viewer). Invite by email grants access to all projects.
- **Project guests** — Project → **Settings** → *Project guests* (the *Team access* section
  above it lists workspace members read-only). Removing a workspace member (from the
  workspace) revokes their access to every project automatically.

## API dependencies
- `POST/PATCH/DELETE /api/workspaces/[id]/members` (workspace roles),
  `POST/PATCH/DELETE /api/projects/[id]/members` (project guests).

## Removed
The earlier per-project role set (project_admin/team_lead/developer/qa/viewer) and the
workspace **custom-roles builder** were replaced by this four-role model.
