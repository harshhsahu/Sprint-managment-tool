---
covers: ["src/lib/apiHelpers.ts", "src/app/api/notifications/**", "src/components/AppShell.tsx", "src/models/index.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 17 Notifications

## Channels
- **In-app only:** one `Notification` document per recipient, surfaced by the bell in the
  topbar (`src/components/AppShell.tsx:NotificationsBell`) with an unread badge; polled every
  30 s together with pending invitations. UI details:
  [modules/10-notifications-search-activity.md](modules/10-notifications-search-activity.md).
- No app-sent email, Slack or push. The only email users receive is the **password-reset email
  sent by Firebase Auth** (`sendPasswordResetEmail` in `src/app/(auth)/forgot-password/page.tsx`)
  — the app itself still has no mail server. (Earlier versions of this doc said forgot-password
  email was removed; Firebase re-added it in `79ab40a`.)

## Triggers
| Event | Type | Audience | Source |
|---|---|---|---|
| Task created with an assignee | `assignment` | assignee | `POST /api/tasks` |
| Task re-assigned | `assignment` | new assignee (also added to watchers) | `PATCH /api/tasks/[id]` |
| Status change | `status_change` | task watchers | `PATCH /api/tasks/[id]`, `POST /api/tasks/reorder`, `PATCH /api/tasks/bulk` |
| @mention in a comment (`@[Name]` token followed by the user id in parentheses, or `@email`) | `mention` | mentioned users | `POST /api/tasks/[id]/comments` |
| New comment | `comment` | watchers not already mentioned | `POST /api/tasks/[id]/comments` |
| Sprint started / completed | `sprint` | **project guests only** (`Project.members`) — see warning | `PATCH /api/sprints/[id]` |
| Invited to a project (existing account) | `invite` | invitee | `POST /api/projects/[id]/invites` |
| Added to a project as guest | `invite` | added user | `POST /api/projects/[id]/members` |
| Added to a workspace | `invite` | added user | `POST /api/workspaces/[id]/members` |
| Invite accepted / declined | `invite` | the inviter | `PATCH /api/invites/[id]` |

`due_date` is allowed by the `NotificationSchema` enum but nothing emits it (no scheduler/cron
exists).

> [!WARNING]
> Sprint notifications loop over `project.members`, which holds only **guests** — workspace
> members get project access implicitly and are not stored there (see the `ProjectMemberSchema`
> comment in `src/models/index.ts`). So most of a team never receives sprint started/completed
> notifications.

> [!NOTE]
> `POST /api/tasks` sets `watchers: [creator]` only; an assignee set at creation is notified
> once but is **not** added as a watcher, so they get no later status/comment notifications
> unless re-assigned via PATCH.

## Conventions
- Create notifications only through `src/lib/apiHelpers.ts:notify({ user, type, title, body?, link?, actor? })`:
  - **Never notifies yourself** — skipped when `actor` equals `user` (pass `actor` or it will
    notify the actor too).
  - **Never throws** — failures (including a `type` not in the schema enum) are caught and
    only `console.error`-ed; the mutation still succeeds. Add new types to the
    `NotificationSchema` enum first.
  - Called with `await` inside per-recipient loops: one insert per watcher, sequentially, on
    the request path.
- `link` is an in-app path: tasks use `/p/[projectId]/board?task=[taskId]`; sprint start →
  `/p/[projectId]/board`, sprint complete → `/p/[projectId]/reports`; workspace add →
  `/workspaces`. Pending-invite and invite-declined notifications have **no link**.
- `body` is short context: task title, comment text truncated to 140 chars, or role text.
- Read state: clicking marks that one read (`PATCH /api/notifications { ids: [id] }`); "Mark all
  read" sends `{}` which marks **all** of the user's notifications. Contract:
  [api/insights.md](api/insights.md#apinotifications).
- Unread handling: `unreadCount` counts all unread (not capped); the list shows the newest 50.
  The bell badge adds pending invitations, which are separate `Invite` documents and are
  cleared only by accepting/declining.
- No dedup, throttling or retention: keep one `notify` per recipient per mutation, and avoid
  emitting from more than one status write path for the same change (the board fires reorder
  then PATCH; PATCH is a no-op because reorder already wrote the status).
