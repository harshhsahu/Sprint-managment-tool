# 16 Analytics

## Tooling
No external analytics/telemetry provider is wired up in V1. The closest equivalent is the
in-app **Activity / audit log** (`Activity` model) — a durable, per-project record of
meaningful actions, written by `logActivity()` in the API layer.

## Events (audit actions)
| Event (action) | Trigger | Properties |
|---|---|---|
| `task.created` / `task.updated` / `task.deleted` | task mutations | `project`, `task`, `user`, `detail` |
| `task.commented` / `task.duplicated` / `task.bulk_updated` | task sub-actions | `project`, `user`, `detail` |
| `sprint.created` / `sprint.started` / `sprint.completed` / `sprint.archived` | sprint lifecycle | `project`, `sprint`, `user` |
| `project.created` / `project.updated` / `project.member_added` / `project.role_changed` | project changes | `project`, `workspace`, `user` |
| `workspace.created` / `workspace.member_added` / `workspace.role_changed` | workspace changes | `workspace`, `user` |

## Conventions
- Actions are dotted `entity.verb` strings; keep them stable (they're shown in the UI).
- **No PII/secrets** in analytics or logs beyond the user reference and a human `detail`.
- If a real analytics provider is added later, initialize it client-side and mirror these
  event names — do not send passwords, tokens, or emails as event properties.
