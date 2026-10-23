---
covers: ["package.json", "eslint.config.mjs", "next.config.ts", "tsconfig.json"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 19 Testing

## Strategy
There are **no automated tests**: no test files, no test runner in `package.json`, no CI config in the repo. Verification today is lint plus manual checks in `npm run dev`.

Recommended layering when tests are added (proposal, not current state):
- **Unit:** `src/lib/permissions.ts` (role resolution, guest vs workspace rank, read-only on expired plans), `src/lib/plans.ts:resolveStatus`.
- **Integration (API):** route handlers against a throwaway MongoDB — auth, `can()` enforcement, tenant isolation, expired-workspace `403`s.
- **E2E:** the core journeys in [04-user-journeys.md](04-user-journeys.md). Firebase sign-in needs a test project or the Firebase Auth emulator.

## Tooling
| Tool | Command | Status at 5ec7e9c |
|---|---|---|
| ESLint 9 (`eslint-config-next` core-web-vitals + typescript, `eslint.config.mjs`) | `npm run lint` | runs (~6 s); exits 1 — 1 error (`react-hooks/purity`, `src/components/PlanBadge.tsx`), 3 `react-hooks/exhaustive-deps` warnings (calendar, reports, timeline pages) |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **out of memory** even with an 8 GB heap — known, unresolved |
| Next build | `npm run build` | skips type-check and lint by design (`next.config.ts`, commit `90fc712`: they OOM-killed the build worker) |
| Test runner | — | none installed |

> [!WARNING]
> Because `next build` ignores type errors and the standalone typecheck OOMs, **nothing currently catches type errors**. Type-check affected files in your editor and smoke-test the flow in `npm run dev`.

## Conventions
- Prioritise security-critical paths: a `viewer` cannot edit; a non-member gets `404` from another workspace; an expired workspace is read-only for every role.
- For schema changes, verify the field round-trips (save → refetch) — a `200` alone proves nothing (root `AGENTS.md`).

## Running Tests
No tests to run. Current gates:
```bash
npm run lint         # must not add new errors
npm run build        # production build must succeed
# npm run typecheck  # currently OOMs — see above
```

## What Must Be Tested Before Merge
See [22-definition-of-done.md](22-definition-of-done.md).
