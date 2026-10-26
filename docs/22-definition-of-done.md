---
covers: ["package.json", "src/lib/apiHelpers.ts", "src/lib/permissions.ts", "src/models/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 22 Definition of Done

A change is "done" only when all of these are true:

- [ ] Code follows [09-coding-guidelines.md](09-coding-guidelines.md); Next.js APIs checked against `node_modules/next/dist/docs/` (Next 16 differs from older versions).
- [ ] Server/client boundaries respected: no server-only module (`src/lib/db.ts`, `src/models/index.ts`, `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/apiHelpers.ts`, `src/lib/firebase/admin.ts`) imported into a `"use client"` file; no secret in a `NEXT_PUBLIC_*` var.
- [ ] Every new API route calls `withAuth()`; every mutating project-scoped route checks the right capability with `can()`; workspace-level writes check `isWorkspaceManager` **and** `isWorkspaceExpired` (expired plan = read-only). Visibility stays tenant-scoped ([13-security.md](13-security.md)).
- [ ] Request bodies validated with zod (`parseBody`), and any new field is listed in the schema (unlisted fields are stripped).
- [ ] Meaningful mutations call `logActivity` and any relevant `notify`. Task status changes go through all write paths (PATCH, reorder, bulk) — see [modules/03-tasks.md](modules/03-tasks.md).
- [ ] Schema change: model registered via `defineModel()`; field round-trips end-to-end (save → refetch shows it — a `200` is not proof); GET returns it; a root `migration.js` / `migration.<YYYYMMDDHHMM>.js` exists if stored data changes shape (root `AGENTS.md`). <!-- verify:ignore -->
- [ ] Loading / empty / error / read-only states handled in the UI.
- [ ] `npm run lint` adds no new errors and `npm run build` passes. (`npm run typecheck` currently OOMs — see [19-testing.md](19-testing.md); there are no automated tests.)
- [ ] Manually exercised in `npm run dev` with at least an owner and a viewer account.
- [ ] Docs updated in the same change for any contract, data-model or env change (`docs/api/`, `docs/database/`, `docs/modules/`, `docs/ui/`, `docs/current-infrastructure/`, [15-environment-setup.md](15-environment-setup.md)).
- [ ] No new library added for an already-covered concern.
- [ ] Change is small and single-concern ([23-git-workflow.md](23-git-workflow.md)) — remember `master` deploys straight to production.
