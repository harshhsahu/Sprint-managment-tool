---
covers: ["*"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# Kanbo docs — map

Start at the root [AGENTS.md](../AGENTS.md). This page maps every doc to the question it answers.
Each fact has one home; other docs link to it.

| Question | Home |
|---|---|
| Why does Kanbo exist, for whom, what won't we build? How do I judge a request? | [01-product-vision.md](01-product-vision.md) (+ [02](02-business-goals.md), [03](03-user-personas.md), [21](21-roadmap.md)) |
| What's in the product? | [00-project-overview.md](00-project-overview.md) |
| How is the system built, and who owns what state? | [ARCHITECTURE.md](ARCHITECTURE.md) (short: [07](07-system-architecture.md)); state: [11](11-state-management.md) |
| Where does a new file go? | [08-folder-structure.md](08-folder-structure.md); conventions: [09](09-coding-guidelines.md) |
| What does the user do, step by step? | [04-user-journeys.md](04-user-journeys.md) → each module's "Key journeys" |
| Feature detail | [modules/](modules/) `01`–`10` |
| Hard rules for agents | [AGENTS.md](AGENTS.md) (project rulebook) |
| UI tokens, components, a11y | [10-design-system.md](10-design-system.md), [ui/primitives.md](ui/primitives.md), [ui/task-modal.md](ui/task-modal.md) |
| Routes and pages | [05-navigation.md](05-navigation.md) |
| API envelope and errors | [12-api-guidelines.md](12-api-guidelines.md), [18-error-handling.md](18-error-handling.md) |
| Per-endpoint contracts | [api/](api/): auth, tasks, sprints, projects, workspaces, insights |
| Collections and fields | [database/entities.md](database/entities.md) |
| External systems | [current-infrastructure/mongodb.md](current-infrastructure/mongodb.md), [current-infrastructure/firebase.md](current-infrastructure/firebase.md) |
| Auth, secrets, tenant isolation | [13-security.md](13-security.md) |
| Env vars, setup, seed | [15-environment-setup.md](15-environment-setup.md) |
| Verify a change / tests | [19-testing.md](19-testing.md), [22-definition-of-done.md](22-definition-of-done.md) |
| Branches, commits, deploy | [23-git-workflow.md](23-git-workflow.md), [20-deployment.md](20-deployment.md) |
| Performance, notifications, analytics, flags | [14](14-performance.md), [17](17-notifications.md), [16](16-analytics.md), [24](24-feature-flags.md) |
| Why is it like this? | [DECISIONS.md](DECISIONS.md) |
| What's unknown or broken? | [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) |

`plans/` and `brainstorms/` hold only `_TEMPLATE.md`. Write one per change; never back-fill fake ones.
Manifest for `/ai-docs update`: [.ai-docs.json](.ai-docs.json).
