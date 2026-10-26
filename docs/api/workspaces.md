---
covers: ["src/app/api/workspaces/**", "src/app/api/invites/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Workspaces & Invites

## Purpose
Workspace CRUD, workspace membership (roles that apply to every project), super-admin plan
assignment, and the signed-in user's project-invite inbox. Powers the Workspaces page,
`/admin` plans table, and the notifications bell's invitation list.

All routes: `withAuth()` (401 `{error:"Unauthorized"}` without a valid session or for deactivated users), Zod body validation via `parseBody` (422 `{error:"<path>: <msg>; …"}`, 400 on invalid JSON), errors as `{error: string}`. Envelope conventions: [12-api-guidelines.md](../12-api-guidelines.md). Roles/read-only rules: [modules/04-roles-permissions.md](../modules/04-roles-permissions.md).

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/workspaces` | GET | Workspaces the user owns or belongs to; `?all=1` = every workspace (super admin only) |
| `/api/workspaces` | POST | Create a workspace; caller becomes owner; trial starts |
| `/api/workspaces/[id]` | GET | One workspace + caller's `myRole` |
| `/api/workspaces/[id]` | PATCH | Rename/describe (owner/admin) **or** set plan fields (super admin) |
| `/api/workspaces/[id]` | DELETE | Delete workspace + its projects, tasks, sprints (owner or super admin) |
| `/api/workspaces/[id]/members` | POST | Add an existing user by email (owner/admin) |
| `/api/workspaces/[id]/members` | PATCH | Change a member's role (owner/admin) |
| `/api/workspaces/[id]/members` | DELETE | Remove a member or leave (`?userId=`) |
| `/api/invites` | GET | Pending project invites addressed to the caller's email |
| `/api/invites/[id]` | PATCH | Accept / reject a project invite |

---

## GET /api/workspaces

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `all` | `"1"` | Return every workspace. Silently ignored unless `isSuperAdmin(user)`. |

### Response — 200
```ts
{
  workspaces: Array<{
    _id: string; name: string; description: string;
    owner: { _id; name; email; avatarColor };               // populated
    members: Array<{ user: { _id; name; email; avatarColor; designation; active }; role: "owner"|"admin"|"editor"|"viewer" }>;
    plan: "trial"|"pro"|"business"|"enterprise";            // may be absent on pre-billing docs
    subscriptionStatus: "trialing"|"active"|"expired";      // stored, NOT resolved — use resolveStatus()
    trialEndsAt: string; planExpiresAt: string | null;      // null = paid plan never lapses
    createdAt: string; updatedAt: string;
  }>
}
```

### Behavior Notes
- Sorted by `createdAt` ascending. Filter: `{$or: [{owner}, {"members.user"}]}`.
- `subscriptionStatus` is the stored value; clients must call `src/lib/plans.ts:resolveStatus` to detect expiry.

---

## POST /api/workspaces
Body: `{ name: string(2–80), description?: string(≤500) }` → **201** `{ workspace }`.
- Creates `members: [{user: caller, role: "owner"}]`; plan fields come from schema defaults (`pro`, `trialing`, `trialEndsAt = now + 15d`).
- No limit on workspaces per user and no expiry check — a user with a lapsed workspace can create a new one and get a fresh trial.
- Logs `workspace.created`.

---

## GET /api/workspaces/[id]
→ **200** `{ workspace, myRole }` (populated like the list). **404** "Workspace not found or access denied" when the caller has no workspace role (super admin included).

---

## PATCH /api/workspaces/[id]

### Body
```ts
{
  name?: string;              // 2–80
  description?: string;       // ≤500
  plan?: "trial"|"pro"|"business"|"enterprise";   // super admin only
  subscriptionStatus?: "trialing"|"active"|"expired"; // super admin only
  planExpiresAt?: string | null;                  // ISO datetime; super admin only
}
```

### Behavior Notes
- If **any** plan field is present: caller must be super admin (else 403 "Only the super admin can change a workspace's plan"). No workspace-role or expiry check; name/description in the same body are also applied. Logs `workspace.plan_changed` ("Set plan to …").
- Otherwise: caller must be owner/admin (403 "Only workspace owners and admins can edit the workspace"), and the workspace must not be expired (403 `READ_ONLY_MESSAGE`). Logs `workspace.updated`.
- `trialEndsAt` is not accepted — a trial cannot be extended through the API.
- Applied with `findByIdAndUpdate(id, {$set: data})`; 404 if missing. → **200** `{ workspace }` (unpopulated).
- Client mutations: `updateWorkspace` (details) and `setWorkspacePlan` (optimistic, `/admin`) in `src/store/api.ts`.

---

## DELETE /api/workspaces/[id]
Owner (`Workspace.owner`) or super admin; else 403. Deletes `Task` and `Sprint` docs of the workspace's projects, the `Project` docs, then the workspace → **200** `{ ok: true }`.

> [!WARNING]
> Not cascaded: `Comment`, `Activity`, `Invite`, `SavedFilter`, `Notification` and `Dashboard` widgets referencing those projects/tasks remain as orphans. No activity entry is written. Allowed even when the workspace is expired.

---

## POST /api/workspaces/[id]/members
Body: `{ email: string(email), role?: "admin"|"editor"|"viewer" = "editor" }` → **201** `{ workspace }` (members populated).

| Status | When |
|---|---|
| 403 | caller not owner/admin; or workspace expired (`READ_ONLY_MESSAGE`) |
| 404 | no **active** user with that email ("Ask them to register first.") or workspace missing |
| 409 | already a member |

Side effects: `$pull`s the user from `members` (guest rows) of every project in the workspace; notifies the invitee (`type: "invite"`, link `/workspaces`); logs `workspace.member_added`. Does **not** clear `excludedMembers` entries they may have on projects.

## PATCH /api/workspaces/[id]/members
Body: `{ userId: string, role: "admin"|"editor"|"viewer" }` → **200** `{ workspace }`. 403 (not manager / expired), 400 when targeting the owner, 404 member not found. Logs `workspace.role_changed`.

## DELETE /api/workspaces/[id]/members?userId=
- Allowed for owner/admin, or anyone removing **themselves** (leave). 400 if `userId` missing or is the owner. **Not** read-only gated.
- Removes the member, `$pull`s them from every project's guest list in the workspace, and reassigns `lead` → workspace owner on projects they led. Logs `workspace.member_removed`. → **200** `{ ok: true }`.

---

## GET /api/invites
Pending `Invite` docs where `email === caller.email`, newest first, `project` populated (`name key workspace`), `invitedBy` populated. Invites whose project was deleted are filtered out. → **200** `{ invites }`. Polled every 30 s by `src/components/AppShell.tsx:NotificationsBell`.

## PATCH /api/invites/[id]
Body: `{ action: "accept" | "reject" }` → **200** `{ ok: true, status: "accepted"|"rejected" }`.

| Status | When |
|---|---|
| 403 | invite email ≠ caller email |
| 404 | invite missing; or project deleted (invite is then deleted) |
| 409 | already answered |

- Accept: pushes `{user, role: invite.role}` into `Project.members` unless the caller is already a workspace member/owner or already a guest. Notifies `invitedBy`; logs `project.invite_accepted`.
- Reject: notifies `invitedBy`; logs `project.invite_rejected`.
- Not read-only gated (accepting into an expired workspace's project works; the guest is then view-only).
- Edge: an **excluded** workspace member who accepts stays excluded (workspace membership short-circuits the guest push).

Invites are created/revoked per project — see [projects.md](projects.md#post-apiprojectsidinvites).
