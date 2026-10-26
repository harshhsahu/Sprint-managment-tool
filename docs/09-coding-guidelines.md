---
covers: ["eslint.config.mjs", "tsconfig.json", "next.config.ts", "src/**"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 09 Coding Guidelines

## Language & Style
- TypeScript everywhere (`strict: true`, path alias `@/*` → `src/*` in `tsconfig.json`).
- Lint: `npm run lint` runs the **ESLint 9 CLI** (flat config `eslint.config.mjs` =
  `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`). `next lint` no
  longer exists in Next 16. Keep the tree lint-clean.
- `next build` does **not** type-check or lint (`typescript.ignoreBuildErrors` in
  `next.config.ts`, added because the build OOM-killed the CI worker). Lint separately.
  `npm run typecheck` (`tsc --noEmit`) currently runs out of memory — known, unresolved.
- Two-space indent; double quotes; semicolons (match existing files).
- File naming: route handlers `route.ts`; pages `page.tsx`; components PascalCase files.
- Exports: named for primitives (`src/components/ui.tsx`); **default** export for pages,
  layouts, `AppShell`, `TaskModal`, `TaskJourneyModal`, `Providers`; HTTP-verb named exports in route handlers.

## Component Conventions
- Every page under `src/app/(app)/` and `src/app/(auth)/` is a client component (`"use client"`).
  Dynamic params are a Promise: `const { projectId } = use(params)`.
- Server-only modules (`src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/permissions.ts`,
  `src/lib/apiHelpers.ts`, `src/lib/firebase/admin.ts`, `src/models/`) are imported **only**
  from `src/app/api/**`, `src/middleware.ts` (jose only) or the server landing page. There is no
  `server-only` guard — importing one into a client file is a silent bundle/secret leak.
- Data: `useQ.useX(urlOrId)` from `src/store/hooks.ts` for reads; generated
  `use…Mutation()` hooks (e.g. `useUpdateTaskMutation`) for writes, `await trigger(args).unwrap()` inside `try/catch`, show
  `errMsg(e)` from `src/store/api.ts`. Do not call `fetch` directly from components.
- Pass `null` to a `useQ` hook to skip the request (SWR-style conditional fetch).
- **Adjust state during render, not in effects.** The codebase resets derived state with
  the `const [prev, setPrev] = useState(x); if (x !== prev) { setPrev(x); … }` pattern
  (`TaskModal`, `GlobalSearch`, `useSwrLike`). `react-hooks/set-state-in-effect` is
  disabled in 5 places: reading the DOM/URL (theme, `?task=`, viewport width in `AppShell`
  and the board) and seeding edit forms from fetched data (profile, project settings).
- Loose typing is deliberate for populated Mongoose docs: declare a file-local
  `type Any = any` with one `eslint-disable-next-line` rather than scattering `any`.

## Do / Don't
- **Do** enforce permissions on the server with `can()` / `getWorkspaceRole()` — client gating is UX only.
- **Do** gate workspace-level writes with `isWorkspaceExpired()` → `error(READ_ONLY_MESSAGE, 403)`;
  project/task writes get this for free via `can()`.
- **Do** validate every body with a zod schema via `parseBody`; add new model fields to the
  schema **and** the GET response or they are silently stripped (see root `AGENTS.md`).
- **Do** write an `Activity` entry (`logActivity`) and `notify()` for meaningful mutations.
- **Do** gate UI on `myCapabilities` / `readOnly` from `useProject()`, never on a role name.
- **Don't** import server-only code into client components.
- **Don't** add a second library for a concern already covered (charts `recharts`, icons
  `lucide-react`, DnD `@hello-pangea/dnd`, server state RTK Query).
- **Don't** reintroduce SWR or `src/lib/client.ts` — both are leftovers of the pre-`9b332de` data layer.
- **Don't** register a model with `models.X || model(...)`; use `defineModel()`.

## Comments
- Comment the *why*: the codebase's comments record rationale (e.g. reorder route doc
  comment, `next.config.ts` OOM note, `updateTask` SKIP set). Keep them accurate.
- Schema fields with cross-cutting meaning (`key`, `order`, `parentTask`) carry inline notes in `src/models/index.ts`.
