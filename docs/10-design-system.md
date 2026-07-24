# 10 Design System

## Tokens
CSS variables defined in [`globals.css`](../src/app/globals.css) on `:root` (light) and
`.dark`: `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`.
Tailwind v4 maps these via `@theme inline` to `bg-card`, `border-line`, `text-muted`,
`text-accent`, etc. `color-scheme` is set per theme so native controls (selects, date
pickers) render with readable colors.

## Typography
- Fonts: Geist Sans / Geist Mono (via `next/font`), exposed as `--font-geist-sans` / `-mono`.
- Scale: Tailwind defaults; headings are `font-bold`/`font-semibold`, body `text-sm` in dense UI.

## Theming
- Light/dark via a `.dark` class on `<html>`; a tiny inline script in `layout.tsx` applies
  the saved theme (`localStorage.sm_theme`) before paint to avoid a flash.
- Toggle lives in the topbar (`AppShell`). Both themes must stay legible — including native
  `<select>` option popups (that's why `color-scheme` + explicit `option` colors exist).

## Component Primitives
Bespoke, in [`src/components/ui.tsx`](../src/components/ui.tsx): `Avatar`, `Modal`,
`Spinner`, `EmptyState`, `TypeIcon`, `PriorityBadge`, `StatusBadge`. Shared classes:
`.input`, `.btn-primary`/`.btn-ghost`/`.btn-danger`, `.card`, `.chip`. See [`ui/`](ui/).

## Voice & Copy
- Sentence case for labels and buttons; concise, action-first ("Create sprint", "Add task").
- Empty states are friendly and directive ("Backlog is empty.", "You're all caught up 🎉").
- Errors are plain and specific ("A project with key CC already exists in this workspace").
