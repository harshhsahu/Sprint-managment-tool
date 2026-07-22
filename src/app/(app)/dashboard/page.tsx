"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, X, LayoutDashboard, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { fetcher, api } from "@/lib/client";
import { Spinner, Avatar, TypeIcon, PriorityBadge, Modal, EmptyState } from "@/components/ui";
import { PRIORITY_META } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const PIE_COLORS = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#8b5cf6", "#f97316", "#64748b"];
const WIDGET_LABELS: Record<string, string> = {
  assigned_to_me: "Assigned to Me",
  sprint_progress: "Sprint Progress",
  recent_activity: "Recent Activity",
  by_status: "Tasks by Status",
  by_priority: "Tasks by Priority",
  by_assignee: "Tasks by Assignee",
  open_vs_closed: "Open vs Closed",
  upcoming_deadlines: "Upcoming Deadlines",
  team_workload: "Team Workload",
};

function Widget({ w, data, editing, onRemove, onResize }: { w: Any; data: Any; editing: boolean; onRemove: () => void; onResize: () => void }) {
  const statusName = (id: string) => {
    for (const p of data?.projects || []) {
      const s = p.statuses.find((x: Any) => x.id === id);
      if (s) return s.name;
    }
    return id;
  };

  const body = () => {
    if (!data) return <Spinner />;
    switch (w.type) {
      case "assigned_to_me":
        return (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.assignedToMe.map((t: Any) => (
              <Link key={t._id} href={`/p/${t.project}/board?task=${t._id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-line/40">
                <TypeIcon type={t.type} size={12} />
                <span className="font-mono text-xs text-muted">{t.key}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <PriorityBadge priority={t.priority} compact />
              </Link>
            ))}
            {data.assignedToMe.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing assigned to you 🎉</p>}
          </div>
        );
      case "sprint_progress":
        return (
          <div className="space-y-3">
            {data.sprintProgress.map((sp: Any) => (
              <div key={sp.sprint._id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{sp.sprint.name} <span className="text-xs text-muted">· {sp.projectName}</span></span>
                  <span className="text-xs text-muted">{sp.done}/{sp.total} tasks · {sp.donePts}/{sp.totalPts} pts</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${sp.total ? (sp.done / sp.total) * 100 : 0}%` }} />
                </div>
                {sp.sprint.endDate && <p className="mt-1 text-xs text-muted">Ends {formatDate(sp.sprint.endDate)}</p>}
              </div>
            ))}
            {data.sprintProgress.length === 0 && <p className="py-6 text-center text-sm text-muted">No active sprints.</p>}
          </div>
        );
      case "recent_activity":
        return (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {data.recentActivity.map((a: Any) => (
              <div key={a._id} className="flex items-start gap-2 text-xs">
                <Avatar user={a.user} size={20} />
                <div className="min-w-0">
                  <span className="font-medium">{a.user?.name}</span> <span className="text-muted">{a.detail}</span>
                  <div className="text-muted/70">{a.project?.name} · {new Date(a.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && <p className="py-6 text-center text-sm text-muted">No recent activity.</p>}
          </div>
        );
      case "by_status":
      case "by_priority": {
        const src = w.type === "by_status" ? data.byStatus : data.byPriority;
        const entries = Object.entries(src).map(([k, v]) => ({
          name: w.type === "by_status" ? statusName(k) : (PRIORITY_META[k as keyof typeof PRIORITY_META]?.label || k),
          value: v as number,
        }));
        if (!entries.length) return <p className="py-6 text-center text-sm text-muted">No tasks.</p>;
        return (
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={entries} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {entries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="-mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
              {entries.map((e, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{e.name} ({e.value})
                </span>
              ))}
            </div>
          </div>
        );
      }
      case "by_assignee":
      case "team_workload": {
        const entries = data.byAssignee.map((a: Any) => ({ name: a.name, open: a.count - a.done, done: a.done }));
        if (!entries.length) return <p className="py-6 text-center text-sm text-muted">No tasks.</p>;
        return (
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={entries} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="open" stackId="a" fill="#6366f1" />
                <Bar dataKey="done" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case "open_vs_closed": {
        const { open, closed } = data.openVsClosed;
        const total = open + closed || 1;
        return (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex gap-8">
              <div className="text-center"><div className="text-3xl font-bold text-accent">{open}</div><div className="text-xs text-muted">Open</div></div>
              <div className="text-center"><div className="text-3xl font-bold text-green-500">{closed}</div><div className="text-xs text-muted">Closed</div></div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-green-500" style={{ width: `${(closed / total) * 100}%` }} />
            </div>
            <p className="text-xs text-muted">{Math.round((closed / total) * 100)}% of all visible tasks are done</p>
          </div>
        );
      }
      case "upcoming_deadlines":
        return (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.upcomingDeadlines.map((t: Any) => (
              <Link key={t._id} href={`/p/${t.project}/board?task=${t._id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-line/40">
                <TypeIcon type={t.type} size={12} />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className={cn("text-xs", isOverdue(t.dueDate) ? "font-semibold text-red-500" : "text-muted")}>{formatDate(t.dueDate)}</span>
                <Avatar user={t.assignee} size={18} />
              </Link>
            ))}
            {data.upcomingDeadlines.length === 0 && <p className="py-6 text-center text-sm text-muted">No deadlines in the next 14 days.</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("card p-4", w.w === 2 && "md:col-span-2")}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{WIDGET_LABELS[w.type] || w.type}</h3>
        {editing && (
          <div className="flex gap-1">
            <button className="btn-ghost !p-1 text-xs" onClick={onResize} title="Toggle width">{w.w === 2 ? "½" : "1:1"}</button>
            <button className="btn-ghost !p-1 text-red-500" onClick={onRemove} title="Remove widget"><X size={13} /></button>
          </div>
        )}
      </div>
      {body()}
    </div>
  );
}

export default function DashboardPage() {
  const { data: dashData, mutate: mutDash } = useSWR<Any>("/api/dashboards", fetcher);
  const { data } = useSWR<Any>("/api/dashboards/data", fetcher, { refreshInterval: 60000 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const dashboards: Any[] = dashData?.dashboards || [];
  const dash = dashboards.find((d) => d._id === activeId) || dashboards[0];

  async function saveWidgets(widgets: Any[]) {
    await api("/api/dashboards", "POST", { _id: dash._id, name: dash.name, widgets });
    mutDash();
  }

  async function newDashboard() {
    const name = prompt("Dashboard name:");
    if (!name) return;
    const res = await api<Any>("/api/dashboards", "POST", { name, widgets: [{ id: "w1", type: "assigned_to_me", w: 1 }] });
    await mutDash();
    setActiveId(res.dashboard._id);
  }

  async function deleteDashboard() {
    if (!confirm(`Delete dashboard "${dash.name}"?`)) return;
    await api(`/api/dashboards?id=${dash._id}`, "DELETE");
    setActiveId(null);
    mutDash();
  }

  if (!dashData) return <Spinner label="Loading dashboard…" />;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        {dashboards.length > 0 && (
          <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm" value={dash?._id || ""} onChange={(e) => setActiveId(e.target.value)}>
            {dashboards.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={newDashboard}><Plus size={13} /> New dashboard</button>
          {dashboards.length > 1 && editing && (
            <button className="btn-ghost !py-1.5 text-xs text-red-500" onClick={deleteDashboard}><Trash2 size={13} /></button>
          )}
          <button className={cn("btn-ghost !py-1.5 text-xs", editing && "!border-accent text-accent")} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Customize"}
          </button>
        </div>
      </div>

      {dash && dash.widgets.length === 0 && (
        <EmptyState icon={<LayoutDashboard size={40} />} title="Empty dashboard" hint="Add widgets to see your work at a glance."
          action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add widget</button>} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {dash?.widgets.map((w: Any) => (
          <Widget
            key={w.id}
            w={w}
            data={data}
            editing={editing}
            onRemove={() => saveWidgets(dash.widgets.filter((x: Any) => x.id !== w.id))}
            onResize={() => saveWidgets(dash.widgets.map((x: Any) => (x.id === w.id ? { ...x, w: x.w === 2 ? 1 : 2 } : x)))}
          />
        ))}
        {editing && (
          <button className="flex min-h-40 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add widget
          </button>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add widget">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(WIDGET_LABELS).map(([type, label]) => (
            <button
              key={type}
              className="rounded-lg border border-line p-3 text-left text-sm hover:border-accent"
              onClick={async () => {
                await saveWidgets([...dash.widgets, { id: `w${dash.widgets.length + 1}_${type}`, type, w: 1 }]);
                setAddOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
