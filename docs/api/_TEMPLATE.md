# API — {{DOMAIN_NAME}}

> Clone this file per API domain, e.g. `api/orders.md`, `api/users.md`.

## Purpose
<!-- fill: what this group of routes does and which screens it powers. -->

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/{{...}}` | GET | <!-- --> |

---

## GET /api/{{...}}

### Purpose
<!-- one line -->

### Path Parameters
| Param | Type | Description |
|---|---|---|
| `{{param}}` | string | <!-- --> |

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `{{param}}` | number | <!-- default, bounds --> |

### Data Sources
| Field | Source | Function |
|---|---|---|
| `{{field}}` | <!-- system --> | `{{fn()}}` |

### Response — 200
```ts
{
  {{field}}: {{Type}} | null;   // null when {{backend}} not configured
}
```

### Behavior Notes
- <!-- degradation behavior, caching (TTL?), edge cases -->

### Example
```json
{ }
```
