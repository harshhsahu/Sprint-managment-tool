# 19 Testing

## Strategy
No automated test suite exists yet (V1 was validated manually + via type-check, lint, and
production build). This is the highest-value gap to close. Recommended layering:

- **Unit:** `src/lib/permissions.ts` (capability resolution incl. custom roles), utils.
- **Integration (API):** route handlers against an ephemeral MongoDB
  (`mongodb-memory-server`) — auth, capability enforcement, visibility isolation.
- **E2E:** Playwright for the core journeys in [04-user-journeys.md](04-user-journeys.md).

## Tooling (proposed)
- Vitest for unit/integration; `mongodb-memory-server` for a throwaway DB.
- Playwright for E2E against `npm run dev`.

## Conventions
- Test behavior, not implementation. Prioritize security-critical paths: a `viewer` cannot
  edit; a non-member cannot see another workspace; custom-role capabilities are honored.
- Co-locate unit tests next to the module (`*.test.ts`); keep E2E specs under `e2e/`.

## Current Verification Gates (until tests land)
```bash
npx tsc --noEmit     # types
npm run lint         # eslint
npm run build        # production build must pass
```

## What Must Be Tested Before Merge
See [22-definition-of-done.md](22-definition-of-done.md).
