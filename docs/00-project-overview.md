---
covers: ["src/app/**", "src/lib/plans.ts", "package.json"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 00 Project Overview

## Name
Kanbo — Agile Task Management (`package.json` name: `sprint-management`)

## Summary
A hosted, per-seat agile task-management SaaS for small Indian software teams. Teams organize work
into workspaces → projects → sprints → tasks and track it on a Kanban board, backlog, list, calendar,
timeline, dashboards and agile reports. Why it exists and for whom: [01-product-vision.md](01-product-vision.md).

## Current Phase
V1 in production on Google Cloud Run + MongoDB Atlas. Billing is plan-assignment by the super admin
(no payment gateway); an expired trial/plan makes the workspace read-only. No automated tests yet.

## Key Features
| # | Feature | Detail |
|---|---|---|
| 1 | Auth | JWT cookie + Firebase sign-in — [13-security.md](13-security.md), [api/auth.md](api/auth.md) |
| 2 | Roles & guests | owner/admin/editor/viewer + per-project guests — [modules/04-roles-permissions.md](modules/04-roles-permissions.md) |
| 3 | Workspaces & projects | statuses, task types, custom fields, members, invites — [modules/06-workspaces-projects.md](modules/06-workspaces-projects.md) |
| 4 | Tasks | types, subtasks, dependencies, comments, watchers, history, copy link — [modules/03-tasks.md](modules/03-tasks.md) |
| 5 | Kanban board | DnD, WIP limits, swimlanes, quick create, bulk actions — [modules/01-kanban-board.md](modules/01-kanban-board.md) |
| 6 | Backlog & sprints | capacity, start/complete, committed vs completed points — [modules/02-backlog-sprints.md](modules/02-backlog-sprints.md) |
| 7 | List, calendar, timeline | [modules/05-list-calendar-timeline.md](modules/05-list-calendar-timeline.md) |
| 8 | Billing & plans | trial, plan tiers, read-only lock — [modules/07-billing-plans.md](modules/07-billing-plans.md) |
| 9 | Super admin | users + plan assignment — [modules/08-super-admin.md](modules/08-super-admin.md) |
| 10 | Dashboards & reports | [modules/09-dashboards-reports.md](modules/09-dashboards-reports.md) |
| 11 | Notifications, search, activity | [modules/10-notifications-search-activity.md](modules/10-notifications-search-activity.md) |
| 12 | Marketing site | landing + pricing at `/` (`src/app/page.tsx`) |
