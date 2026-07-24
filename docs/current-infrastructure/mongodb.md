# MongoDB

> The single source of truth for every entity in Kanbo.

> [!WARNING]
> `Task.status` and `Task.labels[]` are **string ids into the parent Project**, not DB
> references. Project access is **computed** — a workspace member has access to every
> project without a `Project.members` row (only guests are stored there). Resolve access in
> the permissions layer (`getProjectRole`), don't infer it from `Project.members` alone.

## Role
Stores users, workspaces, projects, sprints, tasks, comments, activity, notifications,
saved filters, and dashboards. All reads/writes go through Mongoose models behind `/api/**`.

## Connection
- **Env var:** `MONGODB_URI`
- **Client:** [`src/lib/db.ts`](../../src/lib/db.ts) — `dbConnect()` caches the connection on
  `global` to survive dev hot-reloads and reuse across route handlers.
- **Auth:** connection string (username/password for Atlas).
- **Access posture:** read/write; a single pooled connection.

## Entities / Collections
| Name | Purpose |
|---|---|
| `users` | accounts, global role, profile |
| `workspaces` | team containers, members, custom roles |
| `projects` | boards; key prefix, statuses, labels, members |
| `sprints` | iterations; lifecycle + point snapshots |
| `tasks` | work items; keys, ordering, relations |
| `comments` | task comments + mentions |
| `activities` | audit log |
| `notifications` | in-app notifications |
| `savedfilters` | persisted filters |
| `dashboards` | per-user widget layouts |

Full field-level schema: [`../database/entities.md`](../database/entities.md).

## Connection Pattern
```ts
// src/lib/db.ts
export async function dbConnect() { /* cached mongoose.connect(MONGODB_URI) */ }
// every API handler starts with withAuth(), which calls dbConnect()
```

## Functions We Call
Standard Mongoose model methods on the exports of `src/models/index.ts`
(`Task`, `Project`, `Sprint`, `User`, `Workspace`, `Comment`, `Activity`,
`Notification`, `SavedFilter`, `Dashboard`): `find`, `findById`, `findOne`,
`create`, `findByIdAndUpdate`, `updateMany`, `bulkWrite`, `countDocuments`, etc.

## Degradation
If MongoDB is unreachable, `dbConnect()` throws and the API handler returns a `500`
`{ error }`. There is no mock fallback (single-datastore app) — the UI shows an error/empty
state. Ensure `MONGODB_URI` is set and reachable in every environment.
