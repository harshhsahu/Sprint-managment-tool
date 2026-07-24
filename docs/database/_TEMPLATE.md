# Database — {{TOPIC}}

> Use `entities.md` to catalog every table/collection/index the product reads or writes,
> and `relationships.md` for how they connect (including cross-system logical references).
> Clone this template as needed.

## Overview
<!-- fill: which store(s), their role, and the connection/env var + client path. -->

**Connection:** `{{ENV_VAR}}` → `{{CLIENT_PATH}}`
**Access posture:** <!-- read-only pool? read/write? -->

---

## Entity: `{{table_or_collection}}`
**Role:** <!-- what it stores -->

| Column | Type | Notes |
|---|---|---|
| `id` | <!-- --> | PK |
| `{{col}}` | <!-- --> | <!-- → cross-system ref? --> |

---

## Cross-System References
<!-- IMPORTANT: document logical references that are NOT foreign keys, e.g.
     "`org_id` here points at Proxy's company.id — not a DB foreign key." -->
