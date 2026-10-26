---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 21 Roadmap

> [!TODO]
> Now / Next / Later below are **proposals** carried over from earlier docs; none were re-confirmed
> on 2026-10-23. Priorities need a human. Only "Done" is evidenced (git history).

## Now
- Make `npm run typecheck` run to completion (it currently runs out of memory, see [19-testing.md](19-testing.md)).
- Automated tests (permissions, read-only lock, workspace isolation, core journeys) — there are none today.
- Close the trial gaps in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) (fresh trial via new workspace; legacy
  workspaces without plan fields never expire).

## Next
- Payment gateway so a workspace can self-upgrade (today the super admin assigns plans).
- Enforce per-plan caps (seats, projects, sprints) — currently display-only in `src/lib/plans.ts:PLANS`.
- Attachments upload (the `attachments` field exists on `TaskSchema` in `src/models/index.ts`; no storage or UI).
- Email notifications for assignment/mention/sprint events (in-app only today).

## Later
- Webhooks / API tokens for integrations.
- Automation rules (e.g. "move to Done when subtasks complete").
- AI assist (summaries, auto-triage).

## Done (from git history)
| Date | Milestone | Commit |
|---|---|---|
| 2026-07-22 | Initial app: auth, RBAC, workspaces/projects, tasks, board, sprints, views, reports | `793ccce` |
| 2026-07-28 | Invite accept/reject, optional/required fields, archive revert, subtask navigation | `f0b9c9e` |
| 2026-07-28 | Labels became a multiselect custom field | `f44a142` |
| 2026-07-28 | Data layer migrated to Redux Toolkit + RTK Query with optimistic UI | `9b332de` |
| 2026-07-28 | Firebase login | `79ab40a` |
| 2026-07-29 | Landing page, plans, owner controls | `22ff6f3` |
| 2026-07-30 | Per-project task types | `97f2931` |
| 2026-07-31 | Dashboard filters; done calendar in project reports | `b3ed8f6`, `5ec7e9c` |
| 2026-10-22 | Expired trial → read-only lock re-enabled; workspace rename/description edit; task "Copy link" (uncommitted at time of writing) | working tree |
