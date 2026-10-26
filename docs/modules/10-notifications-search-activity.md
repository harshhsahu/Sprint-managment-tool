---
covers: ["src/components/AppShell.tsx", "src/app/(app)/layout.tsx", "src/app/(app)/p/[projectId]/activity/**", "src/app/(app)/profile/**", "src/app/api/notifications/**", "src/app/api/search/**", "src/app/api/activity/**", "src/app/api/invites/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Notifications, Search & Activity

> The app shell's cross-cutting surfaces: notifications bell (with pending invitations),
> ⌘K global search, the per-project activity log and the profile page. Contracts:
> [../api/insights.md](../api/insights.md). What creates notifications:
> [../17-notifications.md](../17-notifications.md).

## Purpose
- **Bell:** "what happened to me?" — assignments, mentions, comments, status changes, sprint
  events, invites — plus accept/decline for pending project invitations.
- **Search:** jump to any task or project by title/key from anywhere.
- **Activity:** audit trail of who changed what in a project; the profile shows my own trail.

---

## Business Value
Keeps team members in the loop without email (in-app is the only channel) and gives leads an
audit trail for every task/sprint/member change.

---

## Navigation Flow
1. Every page under `src/app/(app)/` is wrapped by `src/app/(app)/layout.tsx` → `AppShell`.
2. Topbar: search button (or `/`, ⌘K / Ctrl+K), bell, avatar menu (Profile & activity, User
   administration for the super admin, Sign out). Sidebar → project → Activity.
3. Clicking a notification or search result navigates to its `link` / the task in the board
   (`/p/[projectId]/board?task=[taskId]`).

---

## Screens

### 1. Notifications bell (`src/components/AppShell.tsx:NotificationsBell`)
- Polls `GET /api/notifications` and `GET /api/invites` every 30 s.
- Badge = `unreadCount` + number of pending invites, shown as `9+` above 9.
- Dropdown: "Invitations" section first (inviter, project, role; Accept / Decline), then up
  to 50 notifications (unread highlighted), "Mark all read" when badge > 0.
- Click a notification → `PATCH /api/notifications { ids: [id] }` → close → `router.push(link)`
  if it has one.
- Accept/Decline → `PATCH /api/invites/[id] { action }` (invalidates `Invites`,
  `Notifications`, `Projects`) then `refresh()` the shell's workspaces + projects so a newly
  joined project appears in the sidebar.

### 2. Global search (`src/components/AppShell.tsx:GlobalSearch`)
- Opens a `Modal`. Shortcut listener ignores keys typed into inputs/textareas/contenteditable.
- Queries `GET /api/search?q=` once `q.length ≥ 2` (no debounce — one request per keystroke,
  cached per `q`).
- Renders Tasks, Projects, People. Arrow keys / Enter navigate **tasks and projects only**;
  people rows are not clickable. Sprints returned by the API are not shown.

### 3. Project activity (`src/app/(app)/p/[projectId]/activity/page.tsx`)
`GET /api/activity?project=&page=&limit=40`; each row: avatar, `detail`, raw `action` code,
timestamp; Prev/Next paging when `pages > 1`.

### 4. Profile (`src/app/(app)/profile/page.tsx`)
Edit name, designation, timezone (fixed list of 12 zones), avatar colour via
`PATCH /api/auth/me` ([auth.md](../api/auth.md)); "My recent activity" from
`GET /api/activity?user=me&limit=25` (no paging).

---

## UI Components
- `src/components/ui.tsx`: `Modal`, `Avatar`, `Button`, `Spinner` — see [../ui/](../ui/)
- `src/components/PlanBadge.tsx:PlanBadge` in the topbar for the active project's workspace
- `AppCtx` / `src/components/AppShell.tsx:useApp` — shell context `{ me, projects, workspaces, refresh }`

---

## Data Dependencies
1. **Notification** documents — created only by `src/lib/apiHelpers.ts:notify` inside API mutations.
2. **Invite** documents matched by the signed-in user's email (`GET /api/invites`).
3. **Activity** documents — written by `src/lib/apiHelpers.ts:logActivity` in task, sprint,
   project, workspace, invite and user routes.

---

## State Management
- **Server state:** RTK Query (`useQ.useNotifications({ pollingInterval: 30000 })`,
  `useQ.useInvites(...)`, `useQ.useSearch(q)`, `useQ.useActivity(url)`, `useQ.useMe()`).
  Mutations: `useMarkNotificationsMutation` (invalidates `Notifications`),
  `useRespondInviteMutation`.
- `getSearch` has no tags (never invalidated); `Activity` tag is provided but no mutation
  invalidates it — activity lists refresh only on remount/arg change.
- **Client state:** dropdown open flags, search `q`/selection index (reset during render when
  `q` changes), sidebar open (collapsed below 1024 px), theme in `localStorage` key `sm_theme`.
- **Logout** calls `api.util.resetApiState()` so the next user never sees cached data (`79ab40a`).

---

## API Dependencies
- `GET /api/notifications`, `PATCH /api/notifications`
- `GET /api/invites`, `PATCH /api/invites/[id]` ([projects.md](../api/projects.md))
- `GET /api/search?q=`
- `GET /api/activity`
- `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/logout`

---

## Loading / Empty / Error States
- **Loading:** bell renders without a badge until data arrives; activity/profile show `Spinner`.
- **Empty:** "You're all caught up 🎉"; search "No results for “q”"; "No activity recorded yet."
- **Error:** none surfaced. A failed `markNotifications` rejects inside the click handler
  (unhandled; navigation does not happen). Accept/Decline errors (403/404/409) are not shown —
  the busy state just clears.

---

## Key Journeys
| Journey | Steps | Outcome |
|---|---|---|
| Happy path — act on a notification | Teammate assigns a task → `notify(type: "assignment")` → within 30 s badge increments → click | Marked read, board opens with the task modal |
| Accept an invite | Bell → Invitations → Accept | Guest membership added (unless already a workspace member), inviter notified, sidebar shows the project |
| Search jump | Press `/` → type "CC-4" → ↓ → Enter | Navigates to the task on its board |
| Permission branch | Non-member requests `/api/activity?project=X` | 403 `Access denied`; without `project`, users only ever get their own activity |
| Permission branch — invites | Responding to an invite addressed to another email | 403; already answered → 409 |
| Failure | Search query with regex metacharacters, e.g. `a(` | API 500 (unescaped `$regex`); modal shows no results, no error |

---

## Notes & Limits
- Bell lists at most 50 notifications; there is no paging or deletion — old notifications
  accumulate in MongoDB indefinitely.
- "Mark all read" is shown when only invites are pending, but invites are not notifications —
  the badge stays until they are answered.
- Search `users` and `GET /api/users` return users from **all** tenants (name + email).
- Search/dashboard project scoping ignores `Project.excludedMembers`; search also includes
  archived projects.
- Activity `?task=` without `project` is forced to the caller's own entries.

---

## Development Tasks (Next Phases)
> [!TODO]
> No planned work for notifications/search/activity found in the repo (no email/push channel,
> no notification preferences). Needs a human to decide scope.
