# 09 Coding Guidelines

## Language & Style
- TypeScript everywhere; ESLint via `next lint` (`npm run lint`). Keep the tree lint-clean.
- Two-space indent; double quotes; semicolons (match existing files).
- File naming: route handlers are `route.ts`; pages are `page.tsx`; components are PascalCase files.
- Prefer named exports; default export only for Next.js pages/layouts/route handlers.

## Component Conventions
- Interactive pages are **client components** (`"use client"`) — this app is DnD/modal-heavy.
- Server-only modules (`db`, `models`, `auth`, `permissions`, `apiHelpers`) are imported
  **only** inside `src/app/api/**`. Never in a `"use client"` file.
- Data fetching: SWR (`useSWR(fetcher)`); mutations via `api(url, method, body)` then `mutate()`.
- Keep the shared `Any` alias local (`type Any = any`) rather than sprinkling `any` — the
  codebase intentionally uses loose typing for populated Mongoose docs on the client.

## Do / Don't
- **Do** enforce permissions on the server with `can()` — client gating is UX only, not security.
- **Do** validate every request body with a zod schema via `parseBody`.
- **Do** write an `Activity` entry (and `Notification`s) for meaningful mutations.
- **Do** match the density and idiom of surrounding code.
- **Don't** import server-only code into client components.
- **Don't** add a second library for a concern already covered (charts/icons/DnD/fetching).
- **Don't** gate UI on a hard-coded role name — use `myCapabilities` (custom roles exist).

## Comments
- Prefer self-documenting code; comment the *why*, not the *what*.
- Every model schema field with a cross-cutting meaning (e.g. `key`, `order`, `parentTask`)
  carries a short inline note — keep those accurate when you change behavior.
