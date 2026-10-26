---
covers: [".gitignore", "cloudbuild.yaml"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 23 Git Workflow

## Branching
- Default branch is **`master`** (`origin/HEAD -> origin/master`). A stale `origin/main` also exists; don't target it.
- `master` deploys straight to production Cloud Run — there is no staging ([20-deployment.md](20-deployment.md)).
- Observed: most history is committed directly to `master`; one feature branch went through a PR (`redux-ui-first-migration`, merged as PR #1 in `e1e589b`). Prefer a short-lived branch + PR for anything non-trivial, especially auth, permissions, billing or data-model changes.

## Commits
Observed style (23 commits at 5ec7e9c): short, lowercase, imperative-ish free text — **not** Conventional Commits. Examples: `dashboard filters`, `add option to modify the task types`, `optimize the package load`, `redeploy`. Early commits include placeholder messages (`_`).

Going forward (convention, not yet enforced):
- One concern per commit, with a message that says what changed and why (e.g. `fix: workspace PATCH ignored read-only plans`). The *why* is what the decisions log ([DECISIONS.md](DECISIONS.md)) is mined from.
- No `redeploy`/`_` messages — an empty trigger commit should say what it is redeploying.
- Commit author identity varies (personal address recently, GitHub `noreply` earlier); no rule is enforced.

## Pull Requests
- Small and single-purpose. Link a plan/brainstorm doc if one exists (`docs/plans/`, `docs/brainstorms/`).
- Ship contract / data-model / env changes with their doc updates and any root `migration*.js` in the same PR. <!-- verify:ignore -->
- State verification in the description: `npm run lint`, `npm run build`, and the manual flows exercised (`npm run typecheck` currently OOMs; no tests exist).

## Review
- No CI, branch protection or CODEOWNERS config exists in the repo.
- Get a second pair of eyes on changes touching auth (`src/lib/auth.ts`, `src/middleware.ts`, `src/lib/firebase/`), `src/lib/permissions.ts`, `src/lib/plans.ts` or `src/models/index.ts`.

> [!TODO]
> Whether GitHub branch protection or required reviews are configured on `harshhsahu/Sprint-managment-tool` cannot be seen from the repo. Needs a human.
