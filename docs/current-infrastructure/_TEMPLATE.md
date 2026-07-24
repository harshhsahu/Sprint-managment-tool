# {{SYSTEM_NAME}}

> Clone per backend system you integrate, e.g. `current-infrastructure/postgres.md`.
> This is the deep, ground-truth reference for one system.

<!-- One-line role of this system. -->

> [!WARNING]
> <!-- Call out the #1 footgun: e.g. "Users are NOT stored here", or "IDs here are
>      logical references, not foreign keys." -->

## Role
<!-- fill: what this system is the source of truth for. -->

## Connection
- **Env var(s):** `{{ENV_VAR}}`
- **Client:** `{{CLIENT_PATH}}`
- **Auth:** <!-- token / connection string / per-request header -->
- **Access posture:** <!-- read-only? -->

## Entities / Tables / Endpoints
| Name | Purpose |
|---|---|
| `{{name}}` | <!-- --> |

## Schema / Shape
```
<!-- DBML / JSON shape / endpoint list -->
```

## Functions We Call
| Function | Returns | Used by |
|---|---|---|
| `{{fn()}}` | <!-- --> | <!-- module/route --> |

## Degradation
<!-- fill: what happens when this system is unavailable (return null → UI fallback). -->
