# 06 Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript | strict; `.ts`/`.tsx` |
| Framework | Next.js 16 (App Router) | React 19; route handlers as the API layer |
| Styling | Tailwind CSS v4 | + shared classes in `globals.css`; no `@apply` on custom classes |
| UI components | bespoke (`src/components`) | no component library |
| Icons | `lucide-react` | one library only |
| Charts | `recharts` | one library only |
| Drag & drop | `@hello-pangea/dnd` | board, backlog, status reorder |
| Data fetching (client) | `swr` | via `fetcher`/`api` in `src/lib/client.ts` |
| Validation | `zod` | every API request body |
| Auth | `jose` (JWT) + `bcryptjs` | httpOnly cookie session |
| Data store | MongoDB + Mongoose 9 | see `current-infrastructure/mongodb.md` |
| Dates | `date-fns` | formatting/helpers |
| Testing | (none yet) | see 19-testing.md |
| Deployment | Docker (standalone) → Google Cloud Run | see 20-deployment.md |

## Constraints
- **Node:** 22.x (matches the Docker base `node:22-alpine`).
- **One library per concern.** Adding a second charting/icon/DnD/fetching library is a
  review-blocking change.
- **Next.js:** this project pins a specific Next version — read the vendored docs under
  `node_modules/next/dist/docs/` before using framework APIs; conventions may differ from
  training data (see repo-root [`AGENTS.md`](../AGENTS.md)).
- **Tailwind v4:** custom shared classes are plain CSS in `globals.css`, not `@apply`.
