---
covers: ["src/app/(app)/workspaces/**", "src/app/(app)/p/[projectId]/settings/**", "src/components/project/common.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Workspaces & Project Settings

> Working tree as of 2026-10-23 (includes the uncommitted workspace edit form and read-only gating).

## Purpose
Create and administer the tenant container (workspace) and its projects: who is in them,
what workflow/task types/fields each project uses, and who outside the workspace can see a single project.

---

## Business Value
A workspace is the billing unit (plan per workspace — [07-billing-plans.md](07-billing-plans.md)) and the
team boundary: adding someone once grants every project. Per-project configuration lets one
team run a Scrum board and another a bug-triage flow in the same workspace.

---

## Navigation Flow
1. Sidebar / user lands on `/workspaces` (`src/app/(app)/workspaces/page.tsx`).
2. Owner/admin creates a workspace or project, or opens the gear → *Workspace settings* modal.
3. Project cards link to `/p/[projectId]/board`; project config lives at `/p/[projectId]/settings` (`src/app/(app)/p/[projectId]/settings/page.tsx`).

---

## Screens
### 1. Workspaces (`src/app/(app)/workspaces/page.tsx`)
| Element | Who sees it | Data / action |
|---|---|---|
| Workspace card (name, `PlanBadge`, description, first 5 avatars, project tiles) | all members | `useQ.useWorkspaces()` → `GET /api/workspaces`; `useQ.useProjects()` → `GET /api/projects` |
| **New workspace** button + modal | everyone | `createWorkspace` → `POST /api/workspaces` (creator becomes owner, plan defaults → trial clock starts) |
| **New project** tile + modal (name, KEY 2–8 chars auto-suggested from name, description) | owner/admin, hidden when expired | `createProject` → `POST /api/projects` |
| Gear → *Workspace settings* modal | owner/admin (`isWsAdmin`) | see below |
| Trash icon | owner only | `deleteWorkspace` → `DELETE /api/workspaces/[id]` after `confirm()` |

*Workspace settings* modal (new):
- **Details** form — name (2–80) + description (≤500) → `updateWorkspace` → `PATCH /api/workspaces/[id]`; shows "Saved" inline. Inputs disabled and Save hidden when expired.
- **Members** — invite by email + role (`ASSIGNABLE_ROLES`) → `inviteWorkspaceMember`; per-member role `<select>` → `updateWorkspaceMember`; *Remove* → `removeWorkspaceMember`. Owner row shows a locked chip. Invite form hidden and role selects disabled when expired; *Remove* stays enabled.

> [!NOTE]
> The client checks `isWsAdmin` from `ws.members[].role`/`ws.owner`; expiry is computed client-side via
> `src/lib/plans.ts:resolveStatus`. Both are UX only — the server re-checks role and expiry.

### 2. Project settings (`src/app/(app)/p/[projectId]/settings/page.tsx`)
Data: `useProject(projectId)` (`src/components/project/common.tsx:useProject` → `GET /api/projects/[id]`). Edit controls depend on `myCapabilities`: `project:manage` (`isAdmin`), `member:manage`, `task:edit`. Non-admins see "You have the X role — settings are read-only." Every save calls `updateProject` → `PATCH /api/projects/[id]` with only the changed section.

| Section | Saves | Rules / server behaviour |
|---|---|---|
| General | `{name, description}` | name 2–80, description ≤2000 |
| Team access | — (exclude/restore) | Lists workspace owner + members minus excluded. *Remove* → `DELETE /api/projects/[id]/members?userId=` adds to `excludedMembers`; *Restore access* → `POST /api/projects/[id]/members {userId}`. Owner can't be removed. |
| Project guests | invites + guest roles | Email invite (`POST /api/projects/[id]/invites`, account not required), pending list with *Revoke*, guest role select (`PATCH …/members`), *Remove* (`DELETE …/members`). |
| Workflow statuses | `{statuses}` (drag to reorder, color, name, category, WIP limit 0–100) | ≥1 status. Tasks whose status id was removed are moved to the **first** status (server `updateMany`). |
| Task types | `{taskTypes}` (icon from `CURATED_TYPE_ICONS`, color, name) | 1–30 types, unique ids; `epic`/`subtask` (`SYSTEM_TASK_TYPE_IDS`) can't be removed; removing a type still used by tasks → 422 with count. |
| Task fields | `{hiddenFields, requiredFields, customFields}` | Hide from `OPTIONAL_TASK_FIELDS`; soft-require from `REQUIRABLE_TASK_FIELDS` (opens full modal on quick-add, never blocks); custom fields ≤20, types `CUSTOM_FIELD_TYPES`, multiselect options ≤100. Unnamed fields/options are dropped client-side (`normalizeCustomFields`). |
| Archived tasks | per task `PATCH /api/tasks/[id] {archived:false}` | Needs `task:edit`; list from `GET /api/tasks?project=&archived=1&limit=200`. |
| Danger zone | `{archived}` toggle; delete | `project:manage`. Delete → `DELETE /api/projects/[id]` then redirect to `/workspaces`. |

> [!WARNING]
> Removing a custom field or a multiselect option does **not** clean `Task.customFields[fieldId]` values;
> removing a status silently remaps tasks to `statuses[0]`. Removing a task type is the only config change the server blocks.

> [!WARNING]
> Archiving a project removes it from `GET /api/projects` (`archived: {$ne: true}`), so it vanishes from the Workspaces page and sidebar. The only way back to *Unarchive* is the direct `/p/[projectId]/settings` URL.

---

## UI Components
- `Modal`, `Avatar`, `Spinner`, `EmptyState`, `TypeIconGlyph` (shared, `src/components/ui.tsx`)
- `PlanBadge` (shared, `src/components/PlanBadge.tsx`) — plan chip + live trial countdown / "Expired · read-only"; see [ui/primitives.md](../ui/primitives.md)
- `ProjectHeader` (`src/components/project/common.tsx`) — read-only banner
- `IconPicker` (feature-specific, in the settings page)

---

## Data Dependencies
1. **MongoDB `Workspace` / `Project` / `Invite`** — see [database/entities.md](../database/entities.md).
2. **Constants** — `DEFAULT_STATUSES`, `DEFAULT_TASK_TYPES`, `OPTIONAL_TASK_FIELDS`, `REQUIRABLE_TASK_FIELDS`, `CUSTOM_FIELD_TYPES`, `CURATED_TYPE_ICONS` in `src/lib/constants.ts`.

New projects are seeded by `POST /api/projects` with `DEFAULT_STATUSES`, `DEFAULT_TASK_TYPES`, empty guests, `lead` = creator, and a starter multiselect custom field `labels` (Frontend/Backend/Design).

---

## State Management
- **Server state:** RTK Query (`src/store/api.ts`). Tags: workspace mutations invalidate `Workspaces` (+ `Projects`/`Project` for create/delete/update); project mutations invalidate `{type:"Project", id}` and `Projects`; invites invalidate `ProjectInvites`.
- **Client state:** local `useState` form copies (`statuses`, `taskTypes`, `customFields`, …) re-seeded when `project.updatedAt` changes — unsaved edits are lost on any refetch of the project.
- The Workspaces modal keeps its own `manageWs` copy and replaces it with the `workspace` returned by member mutations (no refetch wait).

---

## API Dependencies
- [api/workspaces.md](../api/workspaces.md): `GET`/`POST /api/workspaces`, `PATCH`/`DELETE /api/workspaces/[id]`, `/api/workspaces/[id]/members`.
- [api/projects.md](../api/projects.md): `GET`/`POST /api/projects`, `GET`/`PATCH`/`DELETE /api/projects/[id]`, `/members`, `/invites`, `/field-options`.

---

## Loading / Empty / Error States
- **Loading:** `Spinner` on Workspaces list; "Loading settings…" / "Loading archived tasks…".
- **Empty:** `EmptyState` "No workspaces yet" with Create button; "No workspace members."; "No archived tasks."
- **Error:** API `error` string via `errMsg` shown inline in red (forms) or a red banner (settings). Member role change/remove on the Workspaces modal has **no** catch — a 403 surfaces as an unhandled promise rejection.

---

## Key journeys
| Journey | Steps |
|---|---|
| Happy path | Sign up → *New workspace* → workspace on Pro trial → *New project* "Mobile App" key `APP` → configure statuses/types in Settings → invite teammates from the Workspaces modal. |
| Permission branch | Editor opens Settings → sees read-only notice, all inputs disabled, no Danger zone; a guest sees only their one project. |
| Read-only branch | Trial expired → *New project* tile hidden; settings modal inputs disabled with red notice; server returns 403 `READ_ONLY_MESSAGE` for create/rename/invite/role change. |
| Failure | Workspace invite for an email with no account → 404 "No active user found…" (use a project invite instead, which waits for signup). Duplicate project key in workspace → 409. |

---

## Development Tasks (Next Phases)
> [!TODO]
> No roadmap for this module is recorded in the repo. Gaps observed in code (not commitments): workspace-level email invites for non-users, cascade cleanup of custom-field values, an archived-projects list.
