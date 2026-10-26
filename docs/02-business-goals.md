---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 02 Business Goals

> [!NOTE]
> Rewritten 2026-10-23 after the user confirmed Kanbo is a hosted per-seat SaaS for small Indian
> software teams. The earlier "self-hostable, no paid services" constraints are superseded.

## Primary Goals
1. Convert trial workspaces into paid plans. Every new workspace starts a free trial
   (`TRIAL_DAYS` in `src/lib/plans.ts`); when it lapses the workspace is read-only until the super admin
   assigns a plan ([modules/07-billing-plans.md](modules/07-billing-plans.md)).
2. Let a new team go from sign-up to a running sprint quickly (register → workspace → project → sprint).
3. Make sprint health legible at a glance: dashboards and reports
   ([modules/09-dashboards-reports.md](modules/09-dashboards-reports.md)).
4. Support real team structure: workspaces, projects, one role model, per-project guests.

## Success Metrics
> [!TODO]
> No metric is instrumented in code: there is no analytics SDK ([16-analytics.md](16-analytics.md)) and no
> conversion tracking. The earlier table (time to first sprint < 10 min, < 150 ms perceived board latency,
> ≥ 3 projects per workspace) had no baseline or measurement. Targets and how to measure them need a human.

## Constraints
- Small team; keep the stack minimal, one library per concern ([06-tech-stack.md](06-tech-stack.md)).
- Runs as one Cloud Run service + managed MongoDB Atlas ([20-deployment.md](20-deployment.md)).
- No payment gateway: plans are assigned manually by the single super admin
  (`SUPER_ADMIN_EMAIL` in `src/lib/constants.ts`).
- Prices are in INR paise, exclusive of 18% GST, and live only in `src/lib/plans.ts:PLANS`.
