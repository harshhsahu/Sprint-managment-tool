# 22 Definition of Done

A change is "done" only when all of these are true:

- [ ] Code follows [09-coding-guidelines.md](09-coding-guidelines.md).
- [ ] Server/client boundaries respected; no server-only module (`db`/`models`/`auth`/
      `permissions`/`apiHelpers`) imported into a client component; no secrets in the bundle.
- [ ] Every mutating route checks the correct capability with `can()`; visibility stays scoped.
- [ ] Request bodies validated with zod (`parseBody`).
- [ ] Meaningful mutations write an `Activity` entry and any relevant `Notification`s.
- [ ] Loading / empty / error states handled in the UI.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.
- [ ] Docs updated in the same commit (`api/`, `database/`, `modules/`, `ui/`,
      `current-infrastructure/`) for any contract or data-model change.
- [ ] No new library added for an already-covered concern.
- [ ] PR is small and single-concern ([23-git-workflow.md](23-git-workflow.md)).
