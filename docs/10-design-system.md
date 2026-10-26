---
covers: ["src/app/globals.css", "src/app/layout.tsx", "src/components/ui.tsx", "src/components/PlanBadge.tsx", "src/components/brand.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# 10 Design System

## Tokens
CSS variables in `src/app/globals.css`, on `:root` (light) and `.dark`:

| Variable | Light | Dark | Tailwind utility (via `@theme inline`) |
|---|---|---|---|
| `--background` | `#f8fafc` | `#000000` | `bg-background` |
| `--foreground` | `#0f172a` | `#ededed` | `text-foreground` |
| `--card` | `#ffffff` | `#0e0e11` | `bg-card` |
| `--border` | `#e2e8f0` | `#26262b` | `border-line`, `bg-line` (note: **line**, not border) |
| `--muted` | `#64748b` | `#9a9aa5` | `text-muted` |
| `--accent` | `#4f46e5` | `#5b8def` | `bg-accent`, `text-accent`, `bg-accent/10` |

`color-scheme` is set per theme so native controls render readable; `select, option` get
explicit `--card`/`--foreground` colours because OS popups otherwise show light text on white (Windows).

Semantic colours that are **not** tokens (hard-coded Tailwind palette): danger `red-500`/`#dc2626`,
trial chips `blue-500`/`amber-500`, epic chip `purple-500`, priority/status/type colours from
`src/lib/constants.ts` (`PRIORITY_META`, `DEFAULT_TASK_TYPES`) and per-project status colours,
plan colours from `src/lib/plans.ts:PLANS`. Tinted chips use `${color}22` (≈13 % alpha) backgrounds.

## Typography
- Fonts: Geist Sans / Geist Mono via `next/font/google` in `src/app/layout.tsx`, exposed as
  `--font-geist-sans` / `--font-geist-mono` and mapped to `font-sans` / `font-mono`.
- Scale: Tailwind defaults. Page titles `text-xl font-bold`; section headings `font-semibold`;
  dense UI `text-sm`; meta `text-xs text-muted`; issue keys `font-mono text-xs`.

## Theming
- Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *))`, so `dark:` utilities
  follow the `.dark` class on `<html>`, not the OS setting.
- An inline script in `src/app/layout.tsx` applies `localStorage.sm_theme` (or
  `prefers-color-scheme` when unset) before paint; `<html suppressHydrationWarning>` absorbs the class mismatch.
- Toggle: `ThemeToggle` at the bottom of the sidebar in `src/components/AppShell.tsx`.
- Both themes must stay legible — always use tokens (`bg-card`, `text-muted`, `border-line`) rather than raw greys.

## Component Primitives
Bespoke, documented in [ui/primitives.md](ui/primitives.md):
`src/components/ui.tsx` — `Avatar`, `Button`, `Modal`, `Spinner`, `EmptyState`, `TypeIcon`,
`TypeIconGlyph`, `PriorityBadge`, `StatusBadge`, `TYPE_ICON_REGISTRY`;
`src/components/PlanBadge.tsx:PlanBadge`; `src/components/brand.tsx` (`KanboIcon`, `KanboWordmark`).
Complex: [ui/task-modal.md](ui/task-modal.md).

Shared CSS classes (plain CSS in `globals.css`, not `@apply`):

| Class | Use |
|---|---|
| `.input` | text inputs/textarea; accent focus ring |
| `.btn-primary` / `.btn-ghost` / `.btn-danger` (`.btn` base) | buttons; `:active` press scale, focus ring, disabled 50 % opacity |
| `.btn-spinner`, `.is-pending` | spinner inside `Button pending` |
| `.card` | rounded-xl bordered surface (`--card`) — modals, popovers, panels |
| `.chip` | pill for badges (priority, status, plan, trial) |
| `.comment-editor` | placeholder for the contentEditable comment composer |

Size overrides use Tailwind's important modifier on top of the class, e.g.
`className="btn-ghost !px-2 !py-1 text-xs"` — the shared classes set padding, so `!` is required.

## Voice & Copy
- Sentence case for labels and buttons; concise, action-first ("Create sprint", "Copy link").
- Empty states are friendly and directive ("Backlog is empty.", "You're all caught up 🎉").
- Errors are plain and specific; server messages are shown verbatim via `errMsg()`
  ("A project with key CC already exists in this workspace").
- Read-only lock copy: "This workspace's trial/plan has expired …" (banner in
  `ProjectHeader`, TaskModal comment area, `READ_ONLY_MESSAGE` from the API).
