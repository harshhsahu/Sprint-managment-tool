---
covers: ["src/app/api/projects/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Projects

## Purpose
Project CRUD and configuration (statuses, task types, fields), project guests and per-project
exclusions of workspace members, email invitations, and inline multiselect options. Powers the
Workspaces page, every project view (`useProject`), and Project Settings.

All routes: `withAuth()` (401), `parseBody` Zod validation (422 / 400), errors `{error: string}`.
Envelope: [12-api-guidelines.md](../12-api-guidelines.md). Authorization helpers and the read-only collapse: [modules/04-roles-permissions.md](../modules/04-roles-permissions.md). Fields: [database/entities.md](../database/entities.md#entity-project).

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/projects` | GET | Projects visible to the caller (optionally `?workspace=`) |
| `/api/projects` | POST | Create a project (workspace owner/admin) |
| `/api/projects/[id]` | GET | Project + `myRole`, `myCapabilities`, `readOnly` |
| `/api/projects/[id]` | PATCH | Update details/config (`project:manage`) |
| `/api/projects/[id]` | DELETE | Delete project, tasks, sprints (`project:manage`) |
| `/api/projects/[id]/members` | POST | Add a guest, or restore an excluded workspace member |
| `/api/projects/[id]/members` | PATCH | Change a guest's role |
| `/api/projects/[id]/members` | DELETE | Remove a guest / exclude a workspace member / leave (`?userId=`) |
| `/api/projects/[id]/invites` | GET | List the project's invites (all statuses) |
| `/api/projects/[id]/invites` | POST | Invite an email (account not required) |
| `/api/projects/[id]/invites` | DELETE | Revoke an invite (`?inviteId=`) |
| `/api/projects/[id]/field-options` | POST | Add an option to a multiselect custom field (`task:edit`) |

---

## GET /api/projects

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `workspace` | ObjectId | Limit to one workspace. If the caller isn't a member, only projects where they're a guest. |

### Response — 200
```ts
{
  projects: Array<{
    _id; workspace: { _id; name; owner: User; members: Array<{ user: User; role }> }; // populated
    name; key; description; lead: User | null;
    members: Array<{ user: User; role: "admin"|"editor"|"viewer" }>; // guests only
    excludedMembers: string[];          // NOT populated here
    statuses; taskTypes; hiddenFields; requiredFields; customFields;
    taskCounter: number; archived: false; createdAt; updatedAt;
  }>
}
```

### Behavior Notes
- Always excludes `archived: true` projects. Without `workspace`: all projects in workspaces the caller owns/belongs to **plus** projects where they're a guest.
- Does **not** honour `excludedMembers`: an excluded workspace member still sees the project in lists/sidebar, but `GET /api/projects/[id]` returns 404 for them.
- Sorted by `createdAt` ascending.

---

## POST /api/projects
Body:
```ts
{ workspace: string; name: string /*2–80*/; key: string /*2–8, /^[A-Za-z][A-Za-z0-9]*$/, stored uppercase*/; description?: string /*≤2000*/ }
```
→ **201** `{ project }`.

| Status | When |
|---|---|
| 403 | caller not workspace owner/admin; or workspace expired (`READ_ONLY_MESSAGE`) |
| 409 | key already used in this workspace (also enforced by unique index `{workspace, key}`) |

Seeds: `statuses = DEFAULT_STATUSES`, `taskTypes = DEFAULT_TASK_TYPES`, `members = []`, `lead = caller`, `customFields = [{id:"labels", name:"Labels", type:"multiselect", options: frontend/backend/design}]`. Logs `project.created`.

---

## GET /api/projects/[id]
404 "Project not found or access denied" when `getProjectRole` is null (incl. excluded members).

### Response — 200
```ts
{
  project: { /* as list item */ excludedMembers: User[] /* populated */ ; members: Array<{ user: User /* + designation, active */; role }> };
  myRole: "owner"|"admin"|"editor"|"viewer";   // role is kept even when read-only
  myCapabilities: Capability[];                // ["project:view"] when workspace expired
  readOnly: boolean;                           // true when the workspace's plan/trial lapsed
}
```
Consumed via `src/components/project/common.tsx:useProject`.

---

## PATCH /api/projects/[id]
Requires `project:manage` (403 "You don't have permission to update project settings" — also returned for every role when read-only).

### Body (all optional)
| Field | Type / limits |
|---|---|
| `name` | string 2–80 |
| `description` | string ≤2000 |
| `lead` | string (user id — **not validated** against membership) |
| `statuses` | ≥1 × `{id, name(1–40), color(≤20), category: todo|in_progress|done, order: number, wipLimit: 0–100}` |
| `taskTypes` | 1–30 × `{id, name(1–40), color(≤20), icon(≤40), system?}` |
| `hiddenFields`, `requiredFields` | string[] ≤30 |
| `customFields` | ≤20 × `{id, name(1–40), type: text|number|date|multiselect, options?: ≤100 × {id, name(1–40), color(≤20)}}` |
| `archived` | boolean |

### Behavior Notes
- `taskTypes`: 422 if ids aren't unique, if `epic`/`subtask` is missing, or if a removed type is still used by any task in the project ("Can't remove the "X" type — N task(s) still use it…"). Previous types fall back to `DEFAULT_TASK_TYPES` for un-migrated projects.
- `statuses`: tasks whose `status` isn't in the new id list are moved to `statuses[0].id` **before** the project is saved (not atomic).
- Arrays replace wholesale (`$set`). Removing a custom field/option leaves stale values in `Task.customFields`.
- → **200** `{ project }` (lead + guests populated). Logs `project.updated` with `meta = Object.keys(body)`.

---

## DELETE /api/projects/[id]
Requires `project:manage` — **owner and admin** both qualify. Deletes the project's `Task` and `Sprint` docs, then the project. Logs `project.deleted` (workspace-scoped). → **200** `{ ok: true }`.

> [!WARNING]
> `Comment`, `Activity`, `Invite`, `SavedFilter` docs for the project are not deleted. Tasks/sprints are deleted before the existence check, so a bad id still runs two `deleteMany`s (harmless no-ops).

---

## POST /api/projects/[id]/members
Body: `{ userId: string, role?: "admin"|"editor"|"viewer" = "editor" }`. Requires `member:manage`.

| Case | Result |
|---|---|
| user missing or inactive | 404 |
| user is a workspace member **and** in `excludedMembers` | removed from `excludedMembers` → **200** `{ project }` (logs `project.member_restored`) |
| user is a workspace member, not excluded | 409 "already has access to every project" |
| already a guest | 409 |
| otherwise | pushed to `members` → **201** `{ project }`; notifies user; logs `project.member_added` |

## PATCH /api/projects/[id]/members
Body `{ userId, role }`; `member:manage`. Only **guest** rows can be changed (404 for workspace members). → **200** `{ project }`. Logs `project.role_changed`.

## DELETE /api/projects/[id]/members?userId=
- `member:manage`, or the caller removing themselves (bypasses `can`, so works while read-only).
- Target is a workspace member → added to `excludedMembers` (400 if it's the workspace owner); logs `project.member_excluded`.
- Otherwise → removed from guest `members`; logs `project.member_removed`. → **200** `{ ok: true }`.

---

## GET /api/projects/[id]/invites
`member:manage` (403 otherwise). → **200** `{ invites: Invite[] }` (all statuses, `invitedBy` populated, newest first). The settings page shows only `status === "pending"`.

## POST /api/projects/[id]/invites
Body `{ email, role?: "admin"|"editor"|"viewer" = "editor" }`; `member:manage`. → **201** `{ invite }`.

| Status | When (only if the email maps to an existing user) |
|---|---|
| 409 | inviting yourself; a workspace member (incl. excluded ones); already a guest |
| 409 | a pending invite already exists for this project+email |

- Reuses an earlier accepted/rejected `Invite` row for the same project+email (resets to `pending`), else creates one.
- Notifies an existing user (`type: "invite"`, no link); unregistered emails see it after signup via `GET /api/invites`. **No email is sent.**
- Logs `project.invited`.

## DELETE /api/projects/[id]/invites?inviteId=
`member:manage`. Hard-deletes the invite (any status). 404 if not in this project. Logs `project.invite_revoked` (without `workspace`).

---

## POST /api/projects/[id]/field-options
Body `{ fieldId, name: string(1–40), color?: string(≤20) = "#3b82f6" }`. Requires `task:edit` (editors can add options inline; rename/recolor/delete stay in settings).
- 404 if the field is missing or not `multiselect`. Option `id` = slug of `name` (fallback `opt-N`); 409 if that id exists.
- → **201** `{ option, field, customFields }`. Logs `project.field_option_added`. Client: `createFieldOption` invalidates `{type:"Project", id}`.
