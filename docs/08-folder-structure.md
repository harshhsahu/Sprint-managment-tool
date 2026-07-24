# 08 Folder Structure

```
sprint-management/
├── src/
│   ├── middleware.ts             # JWT route protection (redirects)
│   ├── app/
│   │   ├── layout.tsx            # root layout + theme bootstrap
│   │   ├── globals.css           # Tailwind v4 + shared classes + theme tokens
│   │   ├── (auth)/               # public: login, register
│   │   ├── (app)/                # authenticated shell (sidebar/topbar)
│   │   │   ├── dashboard/  my-tasks/  workspaces/  profile/  admin/
│   │   │   └── p/[projectId]/    # board, backlog, list, calendar, timeline,
│   │   │                         #   reports, activity, settings
│   │   └── api/                  # ROUTE HANDLERS — the only code touching MongoDB
│   │       ├── auth/  users/  workspaces/  projects/  sprints/
│   │       ├── tasks/            # + tasks/[id], bulk, reorder, [id]/comments, [id]/duplicate
│   │       ├── search/  notifications/  activity/  filters/
│   │       ├── dashboards/       # + dashboards/data (widget aggregates)
│   │       └── reports/[projectId]/
│   ├── components/
│   │   ├── AppShell.tsx          # sidebar, topbar, search, notifications, theme
│   │   ├── TaskModal.tsx         # the task detail modal (inline edit, comments, subtasks)
│   │   ├── ui.tsx                # Avatar, Modal, Spinner, badges, TypeIcon, EmptyState
│   │   └── project/common.tsx    # useProject, FilterBar, TaskCard, BulkBar, grouping
│   ├── lib/
│   │   ├── db.ts                 # cached Mongoose connection      (server-only)
│   │   ├── auth.ts               # JWT sign/verify, requireUser    (server-only)
│   │   ├── permissions.ts        # RBAC: roles + capabilities      (server-only)
│   │   ├── apiHelpers.ts         # withAuth, parseBody, logActivity, notify (server-only)
│   │   ├── client.ts             # SWR fetcher + api() mutation    (client)
│   │   ├── constants.ts          # task types, priorities, roles, CAPABILITIES
│   │   └── utils.ts              # cn, initials, formatDate, isOverdue (isomorphic)
│   └── models/index.ts           # all Mongoose schemas            (server-only)
├── scripts/seed.mjs              # demo data seeder (npm run seed)
├── docs/                         # source of truth (YOU ARE HERE)
├── Dockerfile  cloudbuild.yaml   # deploy (Cloud Run)
└── public/
```

## Placement Rules
- **New API domain** → a folder under `src/app/api/<domain>/route.ts` (+ `[id]/route.ts`
  for item routes). Add/update a matching file in [`api/`](api/).
- **New model/field** → `src/models/index.ts`, and update [`database/entities.md`](database/entities.md).
- **Shared UI** → `src/components/ui.tsx` (or a new file in `components/`); document reusable ones in [`ui/`](ui/).
- **Project-view components/helpers** → `src/components/project/common.tsx`.
- **Server-only logic** stays in `src/lib/*` (db/auth/permissions/apiHelpers/models) — never imported client-side.
- **New capability** → add to `CAPABILITIES` in `src/lib/constants.ts`, map it in
  `BUILTIN_ROLE_CAPS`, and enforce it in the relevant route(s).
