---
covers: ["src/components/ui.tsx", "src/components/PlanBadge.tsx", "src/components/brand.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# Component: UI primitives

> Shared building blocks. Use these before writing new markup; styles come from the shared
> classes in `src/app/globals.css` (see [../10-design-system.md](../10-design-system.md)).

## Location
- `src/components/ui.tsx` — `Avatar`, `Button`, `Modal`, `Spinner`, `EmptyState`,
  `TypeIcon`, `TypeIconGlyph`, `TYPE_ICON_REGISTRY`, `PriorityBadge`, `StatusBadge`
- `src/components/PlanBadge.tsx` — `PlanBadge`
- `src/components/brand.tsx` — `KanboIcon`, `KanboWordmark`

All are client components (`"use client"`), named exports.

## Purpose
Keep avatars, buttons, dialogs, loading/empty states, task-type/priority/status chips and the
plan badge identical across every view and both themes.

## Props
```tsx
Avatar({ user?: { name?: string; avatarColor?: string } | null; size?: number = 24 })
Button({ variant?: "primary" | "ghost" | "danger" = "primary"; pending?: boolean;
         ...ButtonHTMLAttributes<HTMLButtonElement> })
Modal({ open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean })
Spinner({ label?: string = "Loading…" })
EmptyState({ icon?: ReactNode; title: string; hint?: string; action?: ReactNode })
TypeIcon({ type: string; types?: TaskTypeConfig[] | null; size?: number = 14 })
TypeIconGlyph({ icon: string; size?: number = 14; color?: string })
PriorityBadge({ priority: Priority; compact?: boolean })
StatusBadge({ status: string; statuses?: { id: string; name: string; color: string }[] })
PlanBadge({ ws: Workspace /* plan, subscriptionStatus, trialEndsAt, planExpiresAt */; className?: string })
KanboIcon({ size?: number = 32 })
KanboWordmark({ size?: number = 32; className?: string })
```

| Component | Behaviour worth knowing |
|---|---|
| `Avatar` | initials on `avatarColor` (fallback `#64748b`); no `name` → grey "?" titled "Unassigned" |
| `Button` | maps `variant` → `.btn-primary`/`.btn-ghost`/`.btn-danger`; `pending` disables it, sets `aria-busy`, prepends `.btn-spinner` |
| `Modal` | returns `null` when `!open`; Escape and backdrop **mousedown** call `onClose`; `role="dialog" aria-modal`; `max-w-lg`, or `max-w-4xl` with `wide`; header + close button only when `title !== undefined` |
| `Spinner` | centred, `py-10`, for page/section loading |
| `EmptyState` | centred icon/title/hint/action block |
| `TypeIcon` | coloured square from `resolveTaskType(type, types)`; pass the project's `taskTypes` or it falls back to `DEFAULT_TASK_TYPES` |
| `TypeIconGlyph` | lucide icon by name from `TYPE_ICON_REGISTRY`, fallback `CheckSquare` |
| `PriorityBadge` | `.chip` tinted with `PRIORITY_META[priority].color`; unknown → medium; `compact` hides the label |
| `StatusBadge` | looks up the status by id in the project's `statuses`; unknown → grey chip with the raw id |
| `PlanBadge` | plan chip (`PLANS[plan].color`, unknown plan → pro styling) + trial countdown chip (blue → amber ≤3 d → red ≤1 d) or "Expired · read-only" chip; renders nothing when `ws.plan` is falsy |

## Usage Example
```tsx
import { Button, Modal, EmptyState, Spinner } from "@/components/ui";
import { PlanBadge } from "@/components/PlanBadge";

<Button pending={isLoading} onClick={save}>Save</Button>
<Modal open={open} onClose={() => setOpen(false)} title="Create workspace">…</Modal>
{isLoading ? <Spinner label="Loading board…" /> : <EmptyState title="Backlog is empty." />}
<PlanBadge ws={workspace} className="ml-2" />
```

## Variants / States
- Buttons: `primary` (accent fill), `ghost` (bordered card), `danger` (red). Many call sites
  use the raw classes on `<button>`/`<Link>` instead of `Button`; resize with `!px-2 !py-1`.
- `PlanBadge` status comes from `src/lib/plans.ts:resolveStatus` evaluated against a local
  clock that ticks every 30 s, or every 1 s when under 24 h remain (`useNow`) — no refetch needed.

## Notes
- `Modal` has **no focus trap and no scroll lock**; it stacks at `z-50`. Popovers in
  `AppShell`/`FilterBar` use `z-30` backdrop + `z-40` panel.
- `TYPE_ICON_REGISTRY` keys must match `CURATED_TYPE_ICONS` in `src/lib/constants.ts`; adding
  an icon means updating both, or the picker shows icons that render as `CheckSquare`.
- `PlanBadge` treats the client clock as truth for display only; the server decides read-only
  via `src/lib/permissions.ts:isWorkspaceExpired`.
- Don't hand-roll dialogs or spinners — use these so dark mode and Escape handling stay consistent.
