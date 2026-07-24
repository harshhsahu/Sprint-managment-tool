# 21 Roadmap

## Now
- Automated tests (permissions, visibility isolation, core journeys) — see 19-testing.md.
- Cross-user QA of strict isolation and workspace→project propagation.

## Next
- Attachments upload (model field exists; wire storage + UI).
- Email notifications (optional provider) for assignment/mention/sprint events.
- Server-side aggregation for dashboard/reports at large task volumes.
- Richer text in descriptions/comments (currently plain text).

## Later
- Saved dashboard layouts with resize/reorder polish.
- Webhooks / API tokens for integrations.
- Automation rules (e.g. "move to Done when subtasks complete").
- AI assist (summaries, auto-triage) — architecture already routes through `/api/**`.

## Done
- Auth + capability-based RBAC with workspace custom roles.
- Workspaces/projects, tasks (7 types), Kanban DnD, backlog & sprint lifecycle.
- List/Calendar/Timeline views, dashboards, agile reports, search, notifications, audit log.
- Strict workspace/project visibility isolation; workspace invite auto-adds to all projects.
- Inline label creation; Dockerfile + Cloud Run deploy.
