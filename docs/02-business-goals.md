# 02 Business Goals

## Primary Goals
1. Let a new team go from sign-up to a running sprint in under 10 minutes.
2. Make sprint health legible at a glance (progress, velocity, burndown, aging).
3. Support real team structure via workspaces, projects, and capability-based roles.
4. Stay self-hostable and cheap to run (single container + MongoDB).

## Success Metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Time to first sprint | n/a | < 10 min | onboarding walkthrough / seed script |
| Board interaction latency | n/a | < 150 ms perceived (optimistic DnD) | client instrumentation |
| Active projects per workspace | n/a | ≥ 3 | DB aggregate |
| Sprint completion rate | n/a | tracked per project | velocity report |

## Constraints
- Small team; keep the stack minimal (one library per concern).
- Runs on a single Cloud Run service + a managed MongoDB (Atlas).
- No paid third-party services required to run V1 (email/analytics optional).
