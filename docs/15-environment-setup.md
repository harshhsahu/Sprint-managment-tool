---
covers: ["package.json", ".env.example", "scripts/seed.mjs", "src/lib/db.ts", "src/lib/auth.ts", "src/middleware.ts", "src/lib/firebase/**", "src/models/index.ts", "Dockerfile", "next.config.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# 15 Environment Setup

This file is the single home for environment variables. Other docs link here.

## Prerequisites
- Node.js — production image is `node:22-alpine` (`Dockerfile`); use 22.x locally to match. `--env-file` (used by `npm run seed`) needs Node ≥ 20.6.
- npm (lockfile: `package-lock.json`; Docker builds use `npm ci`).
- MongoDB — local, Docker (`docker run -d --name sprint-mongo -p 27017:27017 mongo:7`), or MongoDB Atlas.
- A Firebase project with the Email/Password and Google sign-in providers enabled (the login, register and Google pages call them), plus a service-account key for the Admin SDK. See [current-infrastructure/firebase.md](current-infrastructure/firebase.md).

## Install & Run
```bash
npm install
cp .env.example .env    # both lines ship commented out — uncomment and fill, then add FIREBASE_SERVICE_ACCOUNT
npm run dev             # http://localhost:3000 (Next dev auto-loads .env)
```

| Script | Command | Status at 5ec7e9c |
|---|---|---|
| `npm run dev` | `next dev` | works |
| `npm run build` | `next build` (type-check and lint are skipped inside the build — `next.config.ts`) | not re-run for this doc |
| `npm start` | `next start` | needs a prior build |
| `npm run lint` | `eslint` | runs (~6 s); currently exits 1: 1 error (`react-hooks/purity` in `src/components/PlanBadge.tsx`), 3 `exhaustive-deps` warnings |
| `npm run typecheck` | `tsc --noEmit` | **runs out of memory**, even with an 8 GB heap — known, unresolved |
| `npm run seed` | `node --env-file=.env.local scripts/seed.mjs` | **broken** — `.env.local` no longer exists, Node exits with `.env.local: not found` | <!-- verify:ignore -->

Seed workaround until `package.json` is fixed (not run for this doc):
```bash
node --env-file=.env scripts/seed.mjs
```

## Environment Variables
`.env` (git-ignored) is the authoritative local file. `.env.example` is the committed template but lists `MONGODB_URI`, `MONGODB_DNS_SERVERS` and `JWT_SECRET`, all commented out. Values below are **code defaults**, never real values.

| Var | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes (prod) | Mongo connection string. Read in `src/lib/db.ts` and `scripts/seed.mjs`; default `mongodb://localhost:27017/sprint-management`. |
| `MONGODB_DNS_SERVERS` | no (local only) | Comma-separated DNS servers Node uses before connecting (`src/lib/db.ts`). Set `8.8.8.8,1.1.1.1` when the network's DNS fails Atlas mongodb+srv SRV lookups — symptom: every API call (incl. login) 500s with `querySrv EBADRESP` in the dev log (seen on a phone hotspot, 2026-10-23). Unset = system DNS. |
| `JWT_SECRET` | yes | HS256 key for the `sm_session` JWT. Read in `src/lib/auth.ts` **and** `src/middleware.ts`; default `"dev-secret"` — insecure, see [13-security.md](13-security.md#access-control). |
| `FIREBASE_SERVICE_ACCOUNT` | yes, unless `GOOGLE_APPLICATION_CREDENTIALS` is set | Firebase Admin service-account JSON, as raw JSON, base64-encoded JSON, or double-stringified JSON (`src/lib/firebase/admin.ts`). No default. Missing → `POST /api/auth/login` and `POST /api/auth/register` return `500` with a diagnostic `detail`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | no | Fallback credential: path to a key file, loaded with `applicationDefault()` only when `FIREBASE_SERVICE_ACCOUNT` is unset. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Client-exposed Firebase web config (`src/lib/firebase/client.ts`). Falls back to a hard-coded literal for the `wowdev` Firebase project. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | Client-exposed; literal fallback. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | Client-exposed; fallback `wowdev`. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | no | Client-exposed; literal fallback (Storage is not used by the app). |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | no | Client-exposed; literal fallback. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | Client-exposed; literal fallback. |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | no | Client-exposed; literal fallback. Unused — no Analytics SDK is initialised ([16-analytics.md](16-analytics.md)). |
| `NODE_ENV` | auto | Set by Next / `Dockerfile` (`production`). Controls the cookie `secure` flag (`src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`) and dev-only model recompilation (`src/models/index.ts:defineModel`). |
| `PORT` / `HOSTNAME` | auto | Set in `Dockerfile` (`8080`, `0.0.0.0`); Cloud Run injects `PORT`. Read by the standalone `server.js`, not by app code. | <!-- verify:ignore -->
| `NEXT_TELEMETRY_DISABLED` | no | Set to `1` in `Dockerfile`. |

> [!WARNING]
> `NEXT_PUBLIC_*` values are inlined into the client bundle at **build** time. `.dockerignore` excludes `.env*` and the `Dockerfile` declares no build args, so production builds use the literal fallbacks in `src/lib/firebase/client.ts`. Pointing prod at a different Firebase project needs build args, not Cloud Run runtime vars.

Never commit real secrets: `.gitignore` ignores `.env*` except `.env.example`.

## Seed Data & Demo Accounts
`scripts/seed.mjs` uses loose (`strict: false`) schemas and is idempotent: it exits early if `alice@demo.dev` exists. It creates 5 users, workspace "NeevCloud Engineering", project "Cloud Console" (`CC`) with sprints, tasks, comments and activity.

| Email | Workspace role | DB `role` |
|---|---|---|
| `alice@demo.dev` | owner | `super_admin` (display only) |
| `bob@demo.dev` | admin | `member` |
| `carol@demo.dev` | editor | `member` |
| `dave@demo.dev` | editor | `member` |
| `erin@demo.dev` | viewer | `member` |

> [!WARNING]
> The seed writes only a bcrypt `passwordHash` (password `password123`); it creates **no Firebase users**. Login goes through Firebase, so demo accounts cannot sign in until Firebase users with those emails exist (login then matches by email and backfills `firebaseUid`). `alice` is **not** a super admin — that is pinned to `src/lib/constants.ts:SUPER_ADMIN_EMAIL`. The seeded workspace has no `trialEndsAt`/`subscriptionStatus`, so `src/lib/plans.ts:resolveStatus` treats it as trialing forever (never read-only).

## Migrations
Rule (root `AGENTS.md`): any change to stored data shape ships a root-level `migration.js` (or `migration.<YYYYMMDDHHMM>.js`) — idempotent, runnable standalone, connects via `MONGODB_URI`, logs counts, documents rollback. <!-- verify:ignore -->
- No `migration*.js` exists in the working tree or in git history at 5ec7e9c. <!-- verify:ignore -->
- There is no `dotenv` dependency, so run a migration with Node's env loader:
```bash
node --env-file=.env migration.js
```

## Notes
- **Mongoose model caching footgun.** Mongoose caches compiled models globally; after adding a schema field while `next dev` runs, a stale model silently strips the field from writes. `src/models/index.ts:defineModel` drops and recompiles models when `NODE_ENV !== "production"` — always register models through it. If a new field still doesn't persist, fully restart `npm run dev`, and confirm the field is in the route's zod schema and returned by the GET. Full rules: root [AGENTS.md](../AGENTS.md).
- **Super admin** = the account whose email equals `SUPER_ADMIN_EMAIL`. The register page copy "The first account becomes the super admin." (`src/app/(auth)/register/page.tsx`) is stale.
- **No DB → no app.** If `MONGODB_URI` is unreachable, `dbConnect()` throws and API calls fail; there is no mock fallback.
- **Next.js 16.** Read `node_modules/next/dist/docs/` before writing framework code (root `AGENTS.md`). `next.config.ts` still sets `eslint.ignoreDuringBuilds`, an option Next 16 removed.
