---
covers: ["package.json", "package-lock.json", "next.config.ts", "Dockerfile", "eslint.config.mjs", "postcss.config.mjs"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 06 Tech Stack

Versions are the resolved ones in `package-lock.json` (range in `package.json` in brackets).

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.9.3 (`^5`) | `strict`; TS/TSX only; alias `@/*` |
| Framework | Next.js 16.2.11 (pinned) | App Router; route handlers are the API; `output: "standalone"` |
| UI runtime | React / React DOM 19.2.4 (pinned) | almost all pages are client components |
| Styling | Tailwind CSS 4.3.3 (`^4`) via `@tailwindcss/postcss` 4.3.3 | tokens + shared classes in `src/app/globals.css` |
| UI components | bespoke (`src/components/ui.tsx`) | no component library |
| Icons | `lucide-react` 1.25.0 | only icon library; `optimizePackageImports` in `next.config.ts` |
| Charts | `recharts` 3.10.0 | dashboard + reports only |
| Drag & drop | `@hello-pangea/dnd` 18.0.1 | board, backlog, settings reorder |
| Server state (client) | `@reduxjs/toolkit` 2.12.0 (RTK Query) + `react-redux` 9.3.0 | `src/store/`; see [11-state-management.md](11-state-management.md) |
| Validation | `zod` 4.4.3 | every API request body (`parseBody`) |
| Identity | `firebase` 12.16.0 (client) + `firebase-admin` 14.2.0 (server) | email/password + Google |
| Session | `jose` 6.2.4 (HS256 JWT) | httpOnly `sm_session` cookie; `overrides` pins `jwks-rsa`'s `jose` to `^4.15.9` |
| Data store | MongoDB + `mongoose` 9.8.0 | see [current-infrastructure/mongodb.md](current-infrastructure/mongodb.md) |
| Fonts | Geist / Geist Mono via `next/font/google` | |
| Lint | `eslint` 9.39.5 + `eslint-config-next` 16.2.11 | flat config; `npm run lint` |
| Testing | none | see [19-testing.md](19-testing.md) |
| Deployment | Docker (`node:22-alpine`, standalone) → Google Cloud Run | see [20-deployment.md](20-deployment.md) |

### Declared but unused
| Package | Status |
|---|---|
| `swr` 2.4.2 | no imports in `src/` since the RTK Query migration (`9b332de`) |
| `date-fns` 4.4.0 | no imports anywhere |
| `bcryptjs` 3.0.3 | only `scripts/seed.mjs`; app auth is Firebase |

## Constraints
- **Node:** 22.x (Docker base `node:22-alpine`); no `engines` field in `package.json`.
- **One library per concern.** Adding a second charting/icon/DnD/server-state library is a
  review-blocking change. Do not add new `swr` usage.
- **Next.js 16:** read `node_modules/next/dist/docs/` before using framework APIs —
  async `params`, `proxy` replacing `middleware`, `next lint` removed, Turbopack by default.
  Summary in [ARCHITECTURE.md](ARCHITECTURE.md#framework-footguns-nextjs-16).
- **Tailwind v4:** CSS-first config (`@import "tailwindcss"`, `@theme inline`,
  `@custom-variant dark`); no `tailwind.config.*`. Shared classes are plain CSS, not `@apply`.
