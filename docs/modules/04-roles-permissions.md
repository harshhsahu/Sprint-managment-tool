# Module: Roles & Permissions (Custom Roles)

> Capability-based RBAC. Server logic in [`src/lib/permissions.ts`](../../src/lib/permissions.ts);
> capabilities/roles in [`src/lib/constants.ts`](../../src/lib/constants.ts); custom-role UI
> in the Workspaces page; assignment in Project → Settings.

## Purpose
Control what each member can do, using a fixed set of **capabilities** mapped from either a
built-in role or a **workspace-defined custom role**.

## Business Value
Teams model their own access (e.g. a "Reviewer" who can comment but not edit) without code
changes, while the app enforces least privilege on the server.

## Capabilities
`project:view` · `task:create` · `task:edit` · `task:delete` · `task:comment` ·
`sprint:manage` · `member:manage` · `project:manage`.

## Built-in Project Roles → Capabilities
| Role | Capabilities |
|---|---|
| `project_admin` | all |
| `team_lead` | view, task:create/edit/delete/comment, sprint:manage |
| `developer` | view, task:create/edit/comment |
| `qa` | view, task:create/edit/comment |
| `viewer` | view |

## Custom Roles
- Defined per workspace: `Workspace.customRoles[] = { id, name, capabilities[] }`.
- Created via the **Shield** icon on a workspace (capability checkbox matrix).
- Selectable anywhere a project member role is chosen; stored as the role id on
  `Project.members[].role`.

## Resolution & Enforcement
- `getProjectRole(user, projectId)` → role id (lead ⇒ `project_admin`; workspace admin ⇒
  `project_admin`; else the member's role id; else `null`).
- `getCapabilities()` maps that role id to a capability set (built-in map or workspace
  custom role). `can(user, projectId, cap)` gates every mutating route.
- `GET /api/projects/[id]` and `GET /api/tasks/[id]` return `myCapabilities` so the UI hides
  controls the user can't use. **Client gating is UX only** — the server always re-checks.

## Visibility (separate from capabilities)
Users only see workspaces/projects they own or belong to; `super_admin` is a global role for
user administration only and does not see other users' data.

## API Dependencies
- `PATCH /api/workspaces/[id]` (`customRoles`), `POST/PATCH /api/projects/[id]/members`
  (validates role against built-in + workspace custom roles).

## Development Tasks (Next Phases)
- [ ] Per-capability audit of custom roles in the activity log.
- [ ] Duplicate-a-role and role templates.
