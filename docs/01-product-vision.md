---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 01 Product Vision

Kanbo is a hosted, per-seat agile task-management SaaS — kanban, sprints, backlog, timeline,
dashboards and reports in one tool — priced and sold for small Indian software teams.

## Sources & Status

| Status | What | Source |
|---|---|---|
| **Approved direction** | Hosted SaaS sold per workspace / per seat; ICP = small Indian software teams; ship by pushing `master` → Cloud Run | Confirmed by the user, 2026-10-23 |
| **Approved direction** | Positioning: "Ship sprints, not spreadsheets." — one fast tool from backlog to burndown, priced for Indian teams, INR + GST invoicing, free trial with no card | Landing page `src/app/page.tsx:LandingPage` (commit `22ff6f3`) |
| **Approved direction** | An expired trial/plan makes the workspace read-only until a plan is assigned; nothing is deleted | User request 2026-10-22; FAQ copy in `src/app/page.tsx` |
| **Current implementation** | Plans, trial and read-only lock: [modules/07-billing-plans.md](modules/07-billing-plans.md). Feature list: [00-project-overview.md](00-project-overview.md) | Code at `5ec7e9c` + working tree |
| **Proposals** | [21-roadmap.md](21-roadmap.md) Now/Next/Later | Earlier docs, not re-confirmed |
| **Unknowns** | [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | — |

> [!NOTE]
> Direction change, 2026-10-23: earlier versions of this doc described a *self-hostable* tool
> "without per-seat lock-in" with "no billing" as a non-goal. The user confirmed that Kanbo is now a
> hosted per-seat SaaS. Those claims are superseded. See [DECISIONS.md](DECISIONS.md).

## Vision Statement
Be the default agile workspace for small Indian software teams: as clean as Linear, as capable as
Jira for sprint work, and priced in rupees per seat with no add-on pricing.

## Problem
Small teams either outgrow lightweight tools (no sprints, no reports, no roles) or pay for
heavyweight, dollar-priced ones (slow, over-configured, plugin-priced). Both turn day-to-day task
tracking into a chore and hide the signal: what's in this sprint, who's overloaded, will we ship on time.

## Target Audience & ICP
- **Primary:** small Indian software teams (~5–50 people) running sprints. The buyer is the workspace
  owner (team lead / founder / EM). Confirmed by the user, 2026-10-23.
- **Secondary:** admins and editors (developers, QA) who work the board; viewers and per-project
  **guests** (e.g. clients) who "see only what they should" (landing copy). Role detail:
  [03-user-personas.md](03-user-personas.md).

## Problems Solved & Value Proposition

| Customer problem | How Kanbo solves it | Differentiator |
|---|---|---|
| Sprint health is invisible | Velocity, burndown/burnup, throughput, aging, done-calendar reports; widget dashboards | Built in, no plugins |
| Tools priced in USD per seat + add-ons | INR plans (Pro ₹149, Business ₹299 /user/mo ex-GST), GST invoices | "No plugins, no add-on pricing" |
| Process doesn't fit a fixed tool | Per-project statuses, WIP limits, task types, custom fields, required fields | Configurable per project |
| Clients/stakeholders need limited access | Workspace roles + per-project guests | Guest isolation |

## Core Principles
1. **Fast and focused over exhaustive.** Optimistic UI for board/list edits (`src/store/api.ts`), one tool
   from backlog to burndown. Prefer polishing core sprint flows to adding adjacent products.
2. **One role model everywhere.** owner > admin > editor > viewer at workspace and project level, enforced
   server-side by capability (`src/lib/permissions.ts:getCapabilities`). UI hiding is a convenience only.
3. **Billing never destroys data.** An expired workspace becomes read-only, never deleted
   (`src/lib/permissions.ts:isProjectReadOnly`).
4. **Honest pricing in one place.** The landing page derives prices from `src/lib/plans.ts:PLANS`
   so marketing can't drift from what the admin panel sells.
5. **Configuration lives per project.** Statuses, task types and custom fields belong to the project
   (`ProjectSchema` in `src/models/index.ts`), not global enums.

## Why Now
> [!TODO]
> Not determinable from the repository — no PRD, pitch or founder notes explain timing beyond the
> landing copy. Needs a human.

## Strategic Priorities & Success Measures
> [!TODO]
> No measured metrics or targets exist in code (no analytics SDK, see [16-analytics.md](16-analytics.md)).
> The earlier targets in [02-business-goals.md](02-business-goals.md) were never instrumented. Needs a human.

## Non-Goals
- Not a portfolio / resource-planning suite (no dependency-scheduling engine).
- Not a docs/wiki product (no Confluence-style pages).
- Not real-time collaborative editing (no OT/CRDT); updates are request/response with cache invalidation.
- No native mobile apps (responsive web only).
- No self-hosted distribution as a product goal (superseded 2026-10-23).
- No payment gateway yet: plans are assigned by the super admin (`src/app/(app)/admin/page.tsx`).
  Online payment is a future decision, not current scope.

## How Future Agents Must Evaluate Requests
1. **Check against this doc first:** the ICP, principles and non-goals above.
2. **Improve unclear requests:** restate the user problem, propose the smallest change that fits an existing
   module ([modules/](modules/)), and ask before building something adjacent (wiki, chat, time-tracking).
3. **Flag conflicts:** if a request contradicts a principle or non-goal (e.g. a per-role UI hide with no server
   check, deleting data on expiry, hardcoding prices outside `src/lib/plans.ts`), explain the conflict and
   recommend declining or reshaping it.
4. **Direction changes are explicit:** when the user deliberately changes direction, update this doc and add an
   entry to [DECISIONS.md](DECISIONS.md) in the same change.
5. **No fabricated integrations:** if a feature needs a capability the backend lacks (payment gateway, email
   delivery, file storage), describe the required contract in [12-api-guidelines.md](12-api-guidelines.md) /
   [api/](api/) and record it in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Never ship a mock that looks real.
