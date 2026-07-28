"use client";

import { useQ, useUpdateUserMutation, useSetWorkspacePlanMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";
import { Spinner, Avatar } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { isSuperAdminEmail, ROLE_LABELS } from "@/lib/constants";
import {
  PLANS, PLAN_IDS, PLAN_LABELS, STATUS_LABELS, formatPrice,
  resolveStatus, daysRemaining, entitlementEndsAt,
  type PlanId, type SubscriptionStatus,
} from "@/lib/plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/* ------------------------------ small UI bits ------------------------------ */
function PlanBadge({ plan }: { plan: PlanId }) {
  const p = PLANS[plan] || PLANS.trial;
  return (
    <span className="chip font-medium" style={{ background: `${p.color}22`, color: p.color }}>
      {PLAN_LABELS[plan]}
    </span>
  );
}

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  trialing: "bg-blue-500/15 text-blue-500",
  active: "bg-green-500/15 text-green-600",
  expired: "bg-red-500/15 text-red-500",
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* -------------------------- Plans dashboard section ------------------------ */
function PlansDashboard() {
  const { data, isLoading } = useQ.useWorkspacesList("/api/workspaces?all=1");
  const [setPlan] = useSetWorkspacePlanMutation();
  const workspaces: Any[] = data?.workspaces || [];

  async function patchPlan(id: string, set: Any) {
    try {
      await setPlan({ id, set }).unwrap();
    } catch (e) { alert(errMsg(e)); }
  }

  // When the plan changes, default the status sensibly: trial → trialing, paid → active.
  function onPlanChange(ws: Any, plan: PlanId) {
    patchPlan(ws._id, { plan, subscriptionStatus: plan === "trial" ? "trialing" : "active" });
  }

  // Summary metrics (computed from effective status).
  const byPlan: Record<string, number> = {};
  let trialing = 0, active = 0, expired = 0, mrrPaise = 0;
  for (const ws of workspaces) {
    byPlan[ws.plan] = (byPlan[ws.plan] || 0) + 1;
    const status = resolveStatus(ws);
    if (status === "trialing") trialing++;
    else if (status === "active") active++;
    else expired++;
    // Rough MRR: active paid plans × seats × monthly price.
    if (status === "active") {
      const price = PLANS[ws.plan as PlanId]?.priceMonthly ?? 0;
      mrrPaise += (price || 0) * (ws.members?.length || 0);
    }
  }

  if (isLoading) return <Spinner label="Loading workspaces…" />;

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-lg font-bold">Plans &amp; subscriptions</h2>
      <p className="mb-4 text-sm text-muted">
        Assign a plan to each workspace. New workspaces start on a 14-day trial; billing is handled here (no payment gateway yet).
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Workspaces" value={String(workspaces.length)} />
        <StatCard label="Trialing" value={String(trialing)} hint={`${expired} expired`} />
        <StatCard label="Active (paid)" value={String(active)} />
        <StatCard label="Est. MRR" value={formatPrice(mrrPaise)} hint="active × seats × price" />
      </div>

      {/* Per-plan distribution */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PLAN_IDS.map((id) => (
          <span key={id} className="chip" style={{ background: `${PLANS[id].color}18`, color: PLANS[id].color }}>
            {PLAN_LABELS[id]}: <b className="ml-1">{byPlan[id] || 0}</b>
          </span>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Workspace</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Seats</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Renews / expires</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((ws) => {
              const status = resolveStatus(ws);
              const ends = entitlementEndsAt(ws);
              const left = daysRemaining(ws);
              const endInput = ws.planExpiresAt ? new Date(ws.planExpiresAt).toISOString().slice(0, 10) : "";
              return (
                <tr key={ws._id} className="border-b border-line align-top">
                  <td className="px-4 py-3">
                    <span className="block font-medium">{ws.name}</span>
                    <span className="block text-xs text-muted">{ws.members?.length || 0} member(s)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar user={ws.owner} size={24} />
                      <span className="text-xs text-muted">{ws.owner?.email}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{ws.members?.length || 0}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <PlanBadge plan={ws.plan} />
                      <select
                        className="rounded border border-line bg-transparent px-1.5 py-1 text-xs"
                        value={ws.plan}
                        onChange={(e) => onPlanChange(ws, e.target.value as PlanId)}
                      >
                        {PLAN_IDS.map((id) => (
                          <option key={id} value={id}>{PLAN_LABELS[id]} — {formatPrice(PLANS[id].priceMonthly)}</option>
                        ))}
                      </select>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-col gap-1">
                      <span className={cn("chip w-fit", STATUS_STYLE[status])}>{STATUS_LABELS[status]}</span>
                      <select
                        className="rounded border border-line bg-transparent px-1.5 py-1 text-xs"
                        value={ws.subscriptionStatus}
                        onChange={(e) => patchPlan(ws._id, { subscriptionStatus: e.target.value })}
                      >
                        {(["trialing", "active", "expired"] as const).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-xs text-muted">
                      {status === "expired"
                        ? "Lapsed"
                        : ends
                          ? `${left} day(s) left`
                          : "No expiry"}
                    </span>
                    <input
                      type="date"
                      className="mt-1 rounded border border-line bg-transparent px-1.5 py-1 text-xs"
                      value={endInput}
                      title="Set paid-plan expiry date"
                      onChange={(e) =>
                        patchPlan(ws._id, {
                          planExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------- User admin -------------------------------- */
function UserAdministration({ meId }: { meId: string }) {
  const { data } = useQ.useUsers("/api/users?all=1");
  const [updateUser] = useUpdateUserMutation();

  async function patch(id: string, set: Any) {
    try {
      await updateUser({ id, set }).unwrap();
    } catch (e) { alert(errMsg(e)); }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold">User administration</h2>
      <p className="mb-4 text-sm text-muted">Activate/deactivate accounts and manage global roles. New users register themselves at <span className="font-mono">/register</span>.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Designation</th>
              <th className="px-4 py-2">Global role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((u: Any) => (
              <tr key={u._id} className={cn("border-b border-line", !u.active && "opacity-60")}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <Avatar user={u} size={26} />
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{u.designation || "—"}</td>
                <td className="px-4 py-2">
                  <span className={cn("chip", isSuperAdminEmail(u.email) ? "bg-accent/15 text-accent" : "bg-line/40 text-muted")}>
                    {isSuperAdminEmail(u.email) ? ROLE_LABELS.super_admin : ROLE_LABELS.member}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    className={cn("chip cursor-pointer", u.active ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-500")}
                    disabled={u._id === meId}
                    onClick={() => patch(u._id, { active: !u.active })}
                    title={u.active ? "Click to deactivate" : "Click to activate"}
                  >
                    {u.active ? "Active" : "Deactivated"}
                  </button>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const { me } = useApp();

  if (!me) return <Spinner />;
  if (!isSuperAdminEmail(me.email)) {
    return <p className="p-10 text-center text-sm text-muted">Only the super admin can access administration.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-bold">Administration</h1>
      <PlansDashboard />
      <UserAdministration meId={me._id} />
    </div>
  );
}
