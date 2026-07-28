"use client";

import { useEffect, useState } from "react";
import { Clock, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANS, PLAN_LABELS, resolveStatus, entitlementEndsAt, type PlanId,
} from "@/lib/plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** Re-render on an interval so the live countdown ticks without a data refetch. */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Human "time left" string. Shows finer units as the deadline approaches. */
function formatLeft(endMs: number, now: number): string {
  const diff = endMs - now;
  if (diff <= 0) return "0m";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Shows a workspace's plan and, during a trial, a live countdown to when it ends.
 * Expired workspaces show a read-only lock. `ws` needs plan/subscriptionStatus/
 * trialEndsAt/planExpiresAt (as returned by the workspaces API).
 */
export function PlanBadge({ ws, className }: { ws: Any; className?: string }) {
  // Under 24h left, tick every second so the timer feels live near the wire.
  const end = entitlementEndsAt(ws);
  const soon = end ? end.getTime() - Date.now() < 86_400_000 : false;
  const now = useNow(soon ? 1_000 : 30_000);

  if (!ws?.plan) return null;
  const plan = ws.plan as PlanId;
  const meta = PLANS[plan] || PLANS.pro;
  const status = resolveStatus(ws, new Date(now));

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span
        className="chip font-semibold"
        style={{ background: `${meta.color}22`, color: meta.color }}
        title={`Plan: ${PLAN_LABELS[plan]}`}
      >
        <Crown size={11} /> {PLAN_LABELS[plan]}
      </span>

      {status === "trialing" && end && (
        <TrialChip endMs={end.getTime()} now={now} />
      )}

      {status === "expired" && (
        <span className="chip bg-red-500/15 text-red-500" title="Plan expired — this workspace is read-only">
          <Lock size={11} /> Expired · read-only
        </span>
      )}
    </span>
  );
}

function TrialChip({ endMs, now }: { endMs: number; now: number }) {
  const left = formatLeft(endMs, now);
  const daysLeft = Math.floor((endMs - now) / 86_400_000);
  // Escalate colour as the trial runs down: blue → amber (≤3d) → red (≤1d).
  const tone =
    daysLeft <= 1 ? "bg-red-500/15 text-red-500"
    : daysLeft <= 3 ? "bg-amber-500/15 text-amber-600"
    : "bg-blue-500/15 text-blue-500";
  return (
    <span className={cn("chip", tone)} title={`Trial ends ${new Date(endMs).toLocaleString()}`}>
      <Clock size={11} /> Trial · {left} left
    </span>
  );
}
