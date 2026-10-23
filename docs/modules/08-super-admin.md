---
covers: ["src/app/(app)/admin/**", "src/app/api/users/**", "src/middleware.ts", "src/store/api.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Module: Super Admin

> One global operator account manages plans for every workspace and activates/deactivates users.
> Page: `src/app/(app)/admin/page.tsx`. Identity: `src/lib/constants.ts:SUPER_ADMIN_EMAIL`.

## Purpose
Give the Kanbo operator a back-office: see every workspace with its plan/status, assign plans (manual billing), and lock out abusive or departed accounts.

---

## Business Value
There is no payment gateway, so this page *is* the billing system: a workspace becomes paid only when the super admin assigns a plan here.

---

## Who is the super admin
- Exactly one account, by email: `isSuperAdminEmail(email)` compares (trimmed, lowercased) to `SUPER_ADMIN_EMAIL`. Changing it requires a code change + deploy.
- `User.role` (`super_admin|member`) is written at register/login for display/back-compat only (`src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`). Authorization never reads it, so editing the DB role grants nothing.
- Super admin is **not** a workspace superuser: it cannot open projects/tasks it isn't a member of. Its extra powers are listed in [04-roles-permissions.md](04-roles-permissions.md#super-admin).

---

## Navigation Flow
1. User menu (top-right avatar) → **User administration** link, rendered only when `isSuperAdminEmail(me.email)` (`src/components/AppShell.tsx`).
2. `/admin` — guarded server-side by `src/middleware.ts:middleware` (JWT `email` claim; others redirected to `/dashboard`) and client-side by `AdminPage` ("Only the super admin can access administration.").
3. Page shows *Plans & subscriptions* then *User administration*.

---

## Screens
### 1. Plans & subscriptions (`src/app/(app)/admin/page.tsx:PlansDashboard`)
- Data: `useQ.useWorkspacesList("/api/workspaces?all=1")` → every workspace (owner + members populated).
- Stat cards: Workspaces, Trialing (hint: N expired), Active (paid), Est. MRR (`active` × `members.length` × `priceMonthly`).
- Per-plan distribution chips (`PLAN_IDS`).
- Table: Workspace (name, member count), Owner (avatar + email), Seats, Plan (badge + select), Status (resolved chip + raw `subscriptionStatus` select), Renews/expires ("N day(s) left" / "No expiry" / "Lapsed" + date input bound to `planExpiresAt`).

### 2. User administration (`src/app/(app)/admin/page.tsx:UserAdministration`)
- Data: `useQ.useUsers("/api/users?all=1")` → users incl. inactive, sorted by name, **max 100**.
- Columns: User, Designation, Global role (derived from email, not DB), Status toggle (Active/Deactivated → `PATCH /api/users/[id] {active}`), Joined. Own row's toggle is disabled; the API also refuses self-deactivation (400).

---

## State Management
- **Server state:** RTK Query. `setWorkspacePlan` (`src/store/api.ts`) is **optimistic**: `onQueryStarted` patches the `getWorkspacesList` cache entry for `listUrl` (default `/api/workspaces?all=1`) with `Object.assign(ws, set)` and calls `patch.undo()` if the request fails; then invalidates `Workspaces`. Reason (code comment): the controlled `<select>`s are bound to server data and snapped back to the old value until the refetch landed, which read as "the dropdown didn't do anything".
- `updateUser` is not optimistic; it invalidates `Users`.
- **Client state:** none beyond the above; errors surface via `alert(errMsg(e))`.

> [!WARNING]
> If you call `setWorkspacePlan` from a view that reads a different URL key, pass `listUrl`, or the optimistic patch hits the wrong cache entry and the UI snaps back.

---

## API Dependencies
- `GET /api/workspaces?all=1`, `PATCH /api/workspaces/[id]` (plan fields) — [api/workspaces.md](../api/workspaces.md).
- `GET /api/users`, `PATCH /api/users/[id]` — see [Users API](#users-api) below.

### Users API
Contracts for `GET /api/users` and `PATCH /api/users/[id]` live in [api/insights.md](../api/insights.md#get-apiusers). Admin-relevant behaviour: `?all=1` includes inactive users only for the super admin; results are capped at 100; `PATCH` accepts only `{active?, designation?}` (roles are not assignable) and refuses self-deactivation (400).

> [!WARNING]
> `GET /api/users` lets **any authenticated user** list up to 100 active users across **all** workspaces (names + emails), filtered by `?q=`. In a multi-tenant SaaS this is a cross-tenant directory leak. The member pickers that use it should be scoped to workspace members.

Deactivation effect: `src/lib/auth.ts:requireUser` returns null for `active: false`, so every API call from that user gets 401 immediately (existing session cookie is ignored).

---

## Loading / Empty / Error States
- **Loading:** `Spinner` ("Loading workspaces…"); full-page spinner until `me` loads.
- **Empty:** table renders with no rows (no empty-state copy).
- **Error:** `alert()` with the API error; optimistic plan edit rolls back.

---

## Key journeys
| Journey | Steps |
|---|---|
| Happy path | Super admin opens `/admin` → finds "Acme" (Trialing, 3 days left) → Plan select → Business → row shows Business/Active instantly (optimistic) → server confirms. |
| Permission branch | Non-super-admin types `/admin` → middleware redirects to `/dashboard`; a crafted `PATCH /api/workspaces/[id] {plan}` → 403; `PATCH /api/users/[id]` → 403. |
| Failure | PATCH fails (network/validation) → `alert` + optimistic value reverts. User list silently truncates past 100 users. |

---

## Known gaps
- Copy says "manage global roles" and "New workspaces start on a 14-day trial" — roles aren't editable and the trial is 15 days (`TRIAL_DAYS`).
- No search/pagination on either table; `/api/users?all=1` caps at 100.
- No audit view: `workspace.plan_changed` / `user.updated` activity is logged but not shown here.
- Workspace delete by super admin is allowed by the API but has no button on this page.

---

## Development Tasks (Next Phases)
> [!TODO]
> No roadmap for back-office tooling is recorded in the repo. Needs a human.
