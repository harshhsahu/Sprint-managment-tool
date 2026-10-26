---
covers: ["src/**", "scripts/**", "public/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 08 Folder Structure

```
Sprint-managment-tool/
├── migration*.js                 # root-level DB migrations (rule: see root AGENTS.md); none committed at HEAD
├── src/
│   ├── middleware.ts             # sm_session JWT page gate + /admin super-admin gate
│   ├── app/
│   │   ├── layout.tsx            # root layout: Geist fonts, theme bootstrap script, <Providers>
│   │   ├── page.tsx              # PUBLIC marketing landing (server component, pricing from lib/plans)
│   │   ├── globals.css           # Tailwind v4 + theme tokens + shared classes (.btn-*, .card, .chip, .input)
│   │   ├── icon.svg              # favicon
│   │   ├── (auth)/               # public: login, register, forgot-password (+ wordmark layout)
│   │   ├── (app)/                # authenticated shell (layout.tsx → AppShell)
│   │   │   ├── dashboard/  my-tasks/  workspaces/  profile/  admin/
│   │   │   └── p/[projectId]/    # board, backlog, list, calendar, timeline,
│   │   │                         #   reports, activity, settings
│   │   └── api/                  # ROUTE HANDLERS — the only code touching MongoDB
│   │       ├── auth/{login,logout,me,register}/
│   │       ├── users/  workspaces/[id]/members/  invites/[id]/
│   │       ├── projects/[id]/{members,invites,field-options}/
│   │       ├── sprints/[id]/
│   │       ├── tasks/            # + [id], [id]/comments, [id]/duplicate, bulk, reorder
│   │       ├── search/  notifications/  activity/  filters/
│   │       ├── dashboards/       # + dashboards/data (widget aggregates)
│   │       └── reports/[projectId]/
│   ├── components/
│   │   ├── AppShell.tsx          # sidebar, topbar, search, notifications, theme, useApp() context
│   │   ├── TaskModal.tsx         # task detail modal (inline edit, comments, subtasks, copy link)
│   │   ├── TaskJourneyModal.tsx  # per-task status journey (opened from Reports)
│   │   ├── ui.tsx                # Avatar, Button, Modal, Spinner, EmptyState, TypeIcon, badges
│   │   ├── PlanBadge.tsx         # workspace plan chip + live trial countdown / expired lock
│   │   ├── brand.tsx             # KanboIcon, KanboWordmark
│   │   ├── auth/GoogleSignInButton.tsx
│   │   └── project/common.tsx    # useProject, FilterBar, TaskCard, BulkBar, ProjectHeader, useGroups
│   ├── store/                    # client server-state layer (RTK Query)
│   │   ├── api.ts                # createApi: every endpoint, tags, optimistic updates, errMsg
│   │   ├── hooks.ts              # useQ.* SWR-shaped query wrappers + mutation hook re-exports
│   │   ├── store.ts              # configureStore + setupListeners
│   │   └── Providers.tsx         # <Provider store> used in app/layout.tsx
│   ├── lib/
│   │   ├── db.ts                 # cached Mongoose connection                (server-only)
│   │   ├── auth.ts               # JWT sign/verify, getSession, requireUser  (server-only)
│   │   ├── permissions.ts        # roles → capabilities, read-only lock      (server-only)
│   │   ├── apiHelpers.ts         # withAuth, json, error, parseBody, logActivity, notify (server-only)
│   │   ├── firebase/admin.ts     # firebase-admin token verification        (server-only)
│   │   ├── firebase/client.ts    # Firebase Web SDK auth                     (client)
│   │   ├── plans.ts              # plan catalogue, TRIAL_DAYS, resolveStatus (isomorphic)
│   │   ├── constants.ts          # task types, priorities, roles, CAPABILITIES, ROLE_CAPS (isomorphic)
│   │   ├── utils.ts              # cn, initials, formatDate, isOverdue, projectAssignees (isomorphic)
│   │   └── client.ts             # DEAD: pre-RTK SWR fetcher/api(); nothing imports it
│   └── models/index.ts           # all Mongoose schemas via defineModel()   (server-only)
├── scripts/seed.mjs              # demo data seeder (npm run seed; reads .env.local)
├── docs/                         # agent/engineer docs (YOU ARE HERE)
├── Dockerfile  cloudbuild.yaml   # build + deploy to Cloud Run
└── public/                       # static svgs + favicon.ico
```

## Placement Rules

Where does a new X go?

| New thing | Goes in | Also update |
|---|---|---|
| API domain | `src/app/api/<domain>/route.ts` (+ `src/app/api/<domain>/[id]/route.ts`) | `docs/api/<domain>.md` (clone [api/_TEMPLATE.md](api/_TEMPLATE.md)) |
| Endpoint consumed by the UI | a `b.query`/`b.mutation` in `src/store/api.ts` with tags | `useQ` entry or re-export in `src/store/hooks.ts` |
| Model / field / index | `src/models/index.ts` via `defineModel()` | root migration file if stored data changes; [database/entities.md](database/entities.md); route zod schema + GET projection |
| Page | `src/app/(app)/<route>/page.tsx` (`"use client"`, `use(params)`) | sidebar link in `src/components/AppShell.tsx`, [05-navigation.md](05-navigation.md) |
| Project sub-view | `src/app/(app)/p/[projectId]/<view>/page.tsx` | `ProjectHeader` + `useProject`; sidebar sub-nav |
| Shared primitive | `src/components/ui.tsx` | [ui/primitives.md](ui/primitives.md) |
| Project-view helper (filters, cards, grouping) | `src/components/project/common.tsx` | — |
| Complex shared component | new PascalCase file in `src/components/` | a doc under [ui/](ui/) |
| Shared CSS class / token | `src/app/globals.css` (plain CSS, `@theme inline` for tokens) | [10-design-system.md](10-design-system.md) |
| Server-only logic | `src/lib/*` — never imported from `"use client"` files | — |
| Constant used on both sides | `src/lib/constants.ts` or `src/lib/plans.ts` (no server imports) | — |
| Capability | `CAPABILITIES` + `ROLE_CAPS` in `src/lib/constants.ts`; enforce with `can()` in routes | [modules/04-roles-permissions.md](modules/04-roles-permissions.md) |
| Plan / price / limit | `PLANS` in `src/lib/plans.ts` (landing + admin read it) | [modules/07-billing-plans.md](modules/07-billing-plans.md) |
| One-off data fix | root `migration.js` / `migration.<YYYYMMDDHHMM>.js` (rules in root `AGENTS.md`) | — | <!-- verify:ignore -->
