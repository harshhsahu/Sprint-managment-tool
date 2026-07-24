# 17 Notifications

## Channels
- **In-app only** (V1): a `Notification` per user, surfaced by the bell in the topbar
  (`AppShell`) with an unread badge; polled every 30s.
- No email/Slack/push in V1 (forgot-password email was intentionally removed — no mail server).

## Triggers
| Event | Type | Audience |
|---|---|---|
| Task assigned to you | `assignment` | assignee |
| You're @mentioned in a comment | `mention` | mentioned users |
| New comment on a task you watch | `comment` | watchers |
| Status change on a task you watch | `status_change` | watchers |
| Sprint started / completed | `sprint` | project members |
| Added to a workspace/project | `invite` | invitee |

## Conventions
- Created via `notify()` in `src/lib/apiHelpers.ts`; **never notify yourself** (the actor
  is skipped).
- Each notification has `title`, optional `body`, and a `link` (usually
  `/p/[projectId]/board?task=[taskId]`) so clicking it opens the item in context.
- Mark-as-read: single (on click) or all (`PATCH /api/notifications`).
- Keep titles short and specific; dedup is not implemented — avoid emitting duplicates from a single mutation.
