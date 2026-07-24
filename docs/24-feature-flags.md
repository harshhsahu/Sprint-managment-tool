# 24 Feature Flags

Kanbo does **not** use a feature-flag system in V1. Behavior is instead gated by:

- **Capabilities** (RBAC) — what a user can do is controlled by their role's capability set,
  not by flags. See [13-security.md](13-security.md).
- **Presence of configuration** — optional features degrade by config: e.g. email
  notifications are simply absent until a provider is configured.

## If flags are introduced later
- Prefer a small server-evaluated mechanism (env- or DB-backed) exposed through `/api/**`,
  never a client-only flag for anything security-relevant.
- Naming: `feature.<area>.<name>`; default off; record owner + removal plan per flag.

## Active Flags
| Flag | Default | Owner | Purpose | Remove by |
|---|---|---|---|---|
| _(none)_ | — | — | — | — |
