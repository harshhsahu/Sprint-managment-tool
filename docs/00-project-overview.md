# 00 Project Overview

## Name
SprintBoard — Agile Task Management

## Summary
A modern, production-ready agile task-management app for software teams, inspired by Jira
and Linear. Teams organize work into workspaces → projects → sprints → tasks, and track it
on a Kanban board, backlog, list, calendar, timeline, dashboards, and agile reports.

## Current Phase
V1, fully integrated on a single MongoDB. All core modules are built and verified
(auth, RBAC with custom roles, workspaces/projects, tasks, Kanban, sprints/backlog,
views, dashboards, reports, search, notifications, audit log). Deployable via Docker to
Google Cloud Run.

## Key Features
1. **Auth & RBAC:** JWT auth; capability-based roles (built-in + workspace custom roles).
2. **Workspaces & projects:** multi-workspace, projects with a task-key prefix, members & roles.
3. **Tasks:** 7 task types with full lifecycle, subtasks, dependencies, comments, watchers, audit history.
4. **Kanban board:** drag & drop, WIP limits, swimlanes, quick create, bulk actions.
5. **Backlog & sprints:** create/start/complete sprints, capacity, committed vs completed points.
6. **Views:** Kanban, List/Table, Calendar, Timeline/Roadmap — all with shared filters.
7. **Dashboards & reports:** configurable widgets; velocity, burndown/burnup, flow metrics, aging.
8. **Search, notifications, audit log:** global ⌘K search, in-app notifications, full activity trail.
