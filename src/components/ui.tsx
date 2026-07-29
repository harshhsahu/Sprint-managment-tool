"use client";

import { ButtonHTMLAttributes, ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { PRIORITY_META, resolveTaskType, type Priority, type TaskTypeConfig } from "@/lib/constants";
import {
  Zap, Bookmark, CheckSquare, Bug, Search, TrendingUp, GitBranch,
  Flag, Star, Layers, Box, Package, Rocket, Target, Lightbulb, AlertTriangle,
  Wrench, Sparkles, FileText, ClipboardList, FlaskConical, Milestone, GitPullRequest,
  ShieldAlert, Gauge, Puzzle, Palette, Database, Server, Globe, Bell, Heart, Code,
  Feather, Compass, Hammer, type LucideIcon,
} from "lucide-react";

/* ------------------------------ Avatar ------------------------------ */
export function Avatar({
  user,
  size = 24,
}: {
  user?: { name?: string; avatarColor?: string } | null;
  size?: number;
}) {
  if (!user?.name) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-line text-muted shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: user.avatarColor || "#64748b" }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}

/* --------------------------- Type & priority ------------------------ */
/* Curated lucide icons offered as task-type icons. The keys must match the
   names in CURATED_TYPE_ICONS (src/lib/constants.ts). */
export const TYPE_ICON_REGISTRY: Record<string, LucideIcon> = {
  CheckSquare, Bug, Bookmark, Zap, Search, TrendingUp, GitBranch,
  Flag, Star, Layers, Box, Package, Rocket, Target, Lightbulb, AlertTriangle,
  Wrench, Sparkles, FileText, ClipboardList, FlaskConical, Milestone, GitPullRequest,
  ShieldAlert, Gauge, Puzzle, Palette, Database, Server, Globe, Bell, Heart, Code,
  Feather, Compass, Hammer,
};

/** Render a curated lucide icon by name (falls back to CheckSquare). */
export function TypeIconGlyph({ icon, size = 14, color }: { icon: string; size?: number; color?: string }) {
  const Icon = TYPE_ICON_REGISTRY[icon] || CheckSquare;
  return <Icon size={size} color={color} strokeWidth={2.5} />;
}

/** The colored rounded-square task-type badge. Pass the project's `types` so the
    label/color/icon reflect its configuration; omit it (cross-project views) to
    fall back to the built-in defaults. */
export function TypeIcon({ type, types, size = 14 }: { type: string; types?: TaskTypeConfig[] | null; size?: number }) {
  const meta = resolveTaskType(type, types);
  return (
    <span
      className="inline-flex items-center justify-center rounded shrink-0"
      style={{ width: size + 6, height: size + 6, background: meta.color }}
      title={meta.name}
    >
      <TypeIconGlyph icon={meta.icon} size={size - 2} color="white" />
    </span>
  );
}

export function PriorityBadge({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className="chip" style={{ background: `${meta.color}22`, color: meta.color }} title={`Priority: ${meta.label}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {!compact && meta.label}
    </span>
  );
}

export function StatusBadge({ status, statuses }: { status: string; statuses?: { id: string; name: string; color: string }[] }) {
  const s = statuses?.find((x) => x.id === status);
  return (
    <span className="chip" style={{ background: `${s?.color || "#64748b"}22`, color: s?.color || "#64748b" }}>
      {s?.name || status}
    </span>
  );
}

/* ------------------------------ Button ------------------------------ */
/**
 * Button with built-in click feel and async feedback.
 * - The `:active` press animation (see globals.css) fires instantly on click.
 * - Pass `pending` while a mutation runs: the label gains a spinner and the
 *   button becomes non-interactive, so the user sees the action registered
 *   immediately instead of a dead button while the API call is in flight.
 */
export function Button({
  variant = "primary",
  pending = false,
  className,
  children,
  disabled,
  ...props
}: {
  variant?: "primary" | "ghost" | "danger";
  pending?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = variant === "ghost" ? "btn-ghost" : variant === "danger" ? "btn-danger" : "btn-primary";
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(base, pending && "is-pending", className)}
    >
      {pending && <span className="btn-spinner" aria-hidden />}
      {children}
    </button>
  );
}

/* ------------------------------ Modal ------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[6vh] overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={ref} className={cn("card w-full shadow-2xl", wide ? "max-w-4xl" : "max-w-lg")} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="font-semibold text-sm">{title}</div>
            <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------- Spinner ------------------------------ */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label || "Loading…"}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon && <div className="text-muted/50">{icon}</div>}
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted max-w-sm">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
