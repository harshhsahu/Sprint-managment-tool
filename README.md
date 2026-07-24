# Kanbo — Agile Task Management

A modern, production-ready agile task management application inspired by Jira and Linear. Built with **Next.js 16 (App Router)**, **MongoDB (Mongoose)**, **Tailwind CSS v4**, **SWR**, **@hello-pangea/dnd** and **Recharts**.

## Features

- **Auth & user management** — register / login / logout / password reset (JWT in httpOnly cookie), user profiles (avatar color, designation, timezone), activity history, super-admin user administration (activate/deactivate, global roles). The first registered account becomes the **Super Admin**.
- **RBAC** — one role set (**Owner / Admin / Editor / Viewer**) at both the workspace and project level, capability-enforced in every API route. Workspace membership grants access to all its projects; project "guests" get single-project access.
- **Workspaces & projects** — multiple workspaces, projects per workspace, member invites, project guests, custom workflow statuses (colors, categories, WIP limits, drag-reorder), custom labels, project archive/delete.
- **Tasks** — 7 types (epic, story, task, bug, spike, improvement, subtask), status, priority, assignee, reporter, sprint, epic link, story points, labels, due date, watchers, dependencies (blocked-by), subtasks, comments with @email mentions, per-task activity history, duplicate, archive, delete, bulk updates.
- **Kanban board** — drag & drop between columns with persistent ordering, WIP-limit warnings, swimlanes (assignee / priority / epic), sprint or all-tasks scope, quick task creation, card multi-select with a bulk-action bar.
- **Backlog & sprints** — create/edit/start/complete/archive/delete sprints, sprint goal, dates, team capacity with over-capacity warning, drag tasks between backlog and sprints, committed/completed point tracking, moving incomplete tasks on completion.
- **Views** — Kanban, List/Table (sortable columns, grouping, column show/hide, inline editing, pagination), Calendar (by due date), Timeline/Roadmap (epics + children as Gantt bars), each with shared filters.
- **Search & filters** — global search (⌘K or `/`) across tasks, projects, sprints and people; per-view filters by assignee, priority, type, label + text search; saved filters.
- **Dashboards** — multiple dashboards per user with configurable widgets: Assigned to Me, Sprint Progress, Recent Activity, Tasks by Status/Priority/Assignee, Open vs Closed, Upcoming Deadlines, Team Workload. Add/remove/resize widgets.
- **Reports** — Velocity, Burndown, Burnup, Sprint completion, task distribution (status/type/priority/assignee), aging & blocked tasks, Cycle time, Lead time, Throughput, Cumulative Flow Diagram.
- **Notifications** — assignment, mentions, comments, status changes, sprint started/completed, invitations; unread badge with mark-as-read.
- **Audit log** — every task/sprint/project/permission change recorded and browsable per project and per user.
- **UX** — dark/light theme, responsive layout, keyboard shortcut for search, optimistic drag & drop, accessible focus states.

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB — either local, or via Docker:

```bash
docker run -d --name sprint-mongo -p 27017:27017 mongo:7
```

### Setup

```bash
npm install
cp .env.example .env.local   # adjust MONGODB_URI / JWT_SECRET
npm run seed                 # optional: demo workspace, project, sprints, tasks
npm run dev
```

Open http://localhost:3000.

### Demo accounts (after `npm run seed`)

| Email | Workspace role | Password |
|---|---|---|
| alice@demo.dev | Owner (+ global Super Admin) | password123 |
| bob@demo.dev | Admin | password123 |
| carol@demo.dev | Editor | password123 |
| dave@demo.dev | Editor | password123 |
| erin@demo.dev | Viewer | password123 |

### Environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing session tokens — change in production |

## Architecture

```
src/
├── middleware.ts          # route protection (JWT verification + redirects)
├── lib/
│   ├── db.ts              # cached Mongoose connection
│   ├── auth.ts            # JWT session sign/verify, requireUser()
│   ├── permissions.ts     # RBAC role resolution & checks
│   ├── apiHelpers.ts      # withAuth, zod body parsing, activity log, notifications
│   ├── constants.ts       # task types, priorities, roles, default workflow
│   └── client.ts          # client-side fetch helpers (SWR fetcher + mutations)
├── models/index.ts        # all Mongoose schemas (User, Workspace, Project, Task, …)
├── app/
│   ├── (auth)/            # login, register, forgot/reset password
│   ├── (app)/             # authenticated shell: dashboard, my-tasks, workspaces,
│   │   └── p/[projectId]/ # board, backlog, list, calendar, timeline, reports,
│   │                      # activity, settings
│   └── api/               # REST endpoints (auth, workspaces, projects, tasks,
│                          # sprints, search, notifications, activity, dashboards,
│                          # reports, filters)
└── components/            # AppShell, TaskModal, shared UI + project components
```

Every API route validates the session, checks project/workspace roles, validates the body with zod, and records audit-log entries and notifications where relevant. All list endpoints support filtering, sorting and pagination server-side.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run seed` | Seed demo data (idempotent) |
| `npm run lint` | ESLint |

## Deploying to Google Cloud Run

The app builds to a self-contained image via the multi-stage [`Dockerfile`](Dockerfile) (Next.js `output: "standalone"`). Public/build-time config lives in the Dockerfile; **secrets are supplied at runtime by Cloud Run**, never baked into the image.

### Build & run locally

```bash
docker build -t sprint-management .
docker run -p 8080:8080 \
  -e MONGODB_URI="mongodb+srv://…" \
  -e JWT_SECRET="a-long-random-string" \
  sprint-management
# open http://localhost:8080
```

The container listens on `$PORT` (Cloud Run injects `8080`).

### Deploy

```bash
# 1. Build & push the image (Artifact Registry)
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPO/sprint-management

# 2. Deploy, providing runtime env vars
gcloud run deploy sprint-management \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPO/sprint-management \
  --region REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "MONGODB_URI=mongodb+srv://…,JWT_SECRET=your-secret"
```

For production, store `MONGODB_URI` and `JWT_SECRET` in **Secret Manager** and reference them with `--set-secrets` instead of `--set-env-vars`. Use **MongoDB Atlas** (or another managed MongoDB reachable over the internet) as the database, since Cloud Run has no local Mongo.

### Runtime environment variables (set in Cloud Run, not in the image)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string (e.g. MongoDB Atlas) |
| `JWT_SECRET` | yes | Secret for signing session tokens |
| `PORT` | auto | Injected by Cloud Run (defaults to 8080) |

