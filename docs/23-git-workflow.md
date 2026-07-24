# 23 Git Workflow

## Branching
- Trunk-based: short-lived feature branches off `main`; open a PR into `main`.
- Never commit directly to `main` for non-trivial work.

## Commits
- Conventional commits: `type(scope): summary` (`feat`, `fix`, `chore`, `docs`, `refactor`).
- One concern per commit; keep them reviewable.
- Commits are authored with a GitHub `noreply` email (the account has email-privacy on).

## Pull Requests
- Small, single-purpose. Link the plan/brainstorm doc if one exists (`docs/plans`, `docs/brainstorms`).
- Ship contract/data-model changes with their doc updates in the same PR.
- Include verification: `tsc`, `lint`, `build` green (and tests once they exist).

## Review
- At least one reviewer for changes touching auth, permissions, or the data model.
- CI (once configured) must pass before merge.
