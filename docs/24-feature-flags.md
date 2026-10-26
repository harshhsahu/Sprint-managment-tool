---
covers: ["src/lib/permissions.ts", "src/lib/plans.ts", "src/lib/constants.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 24 Feature Flags

## Tooling
None. There is no flag library, flag env var, or flag collection in the code. Behaviour is gated by three other mechanisms — don't mistake them for flags:

| Mechanism | Where | What it gates |
|---|---|---|
| Capabilities (RBAC) | `src/lib/permissions.ts:can`, `ROLE_CAPS` in `src/lib/constants.ts` | what a role may do — [modules/04-roles-permissions.md](modules/04-roles-permissions.md) |
| Plan status | `src/lib/permissions.ts:isWorkspaceExpired`, `src/lib/plans.ts:resolveStatus` | lapsed trial/plan → whole workspace read-only — [modules/07-billing-plans.md](modules/07-billing-plans.md) |
| Super-admin email | `src/lib/constants.ts:isSuperAdminEmail` | `/admin`, user management, plan assignment |
| `NODE_ENV` | `src/models/index.ts:defineModel`, auth cookie `secure` | dev-only model recompilation; secure cookies in prod |

Plan tiers do not gate features: `PlanLimits` (seats, projects, …) in `src/lib/plans.ts` are shown on the landing and admin pages but no API route enforces them. Only "expired vs not" changes behaviour — see [modules/07-billing-plans.md](modules/07-billing-plans.md).

## Conventions
If flags are introduced:
- Evaluate on the server and expose through `/api/**`; never use a client-only flag for anything security- or billing-relevant.
- Naming: `feature.<area>.<name>`; default off; record owner and removal date in the table below.
- Env-backed flags go in [15-environment-setup.md](15-environment-setup.md); `NEXT_PUBLIC_*` flags are baked in at build time.

## Active Flags
| Flag | Default | Owner | Purpose | Remove by |
|---|---|---|---|---|
| _(none)_ | — | — | — | — |
