"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, LayoutDashboard, Trash2, Settings2, SlidersHorizontal, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  LineChart, Line, AreaChart, Area, CartesianGrid, Legend,
} from "recharts";
import { useQ, useSaveDashboardMutation, useDeleteDashboardMutation } from "@/store/hooks";
import { Spinner, Avatar, TypeIcon, PriorityBadge, Modal, EmptyState } from "@/components/ui";
import { PRIORITY_META, PRIORITIES } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const PIE_COLORS = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#8b5cf6", "#f97316", "#64748b"];
const TT = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

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
  project_growth: "Project Growth",
  velocity_trend: "Velocity Trend",
  throughput: "Throughput",
  team_growth: "Team Growth",
};

// which chart types each widget can render (first = default)
const CHART_OPTIONS: Record<string, string[]> = {
  by_status: ["pie", "donut", "bar"],
  by_priority: ["pie", "donut", "bar"],
  project_growth: ["area", "line", "bar"],
  throughput: ["bar", "area", "line"],
  velocity_trend: ["bar", "line"],
  team_growth: ["bar", "line"],
};
// widgets whose data depends on the date range
const RANGE_WIDGETS = new Set(["project_growth", "throughput", "team_growth"]);
const RANGES = [
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "6m", label: "6 months" },
  { id: "12m", label: "12 months" },
];

// Client copy of the owner/lead template (mirrors TEAM_GROWTH_TEMPLATE on the server).
const TEAM_GROWTH_TEMPLATE = [
  { id: "g1", type: "project_growth", w: 2, chartType: "area", range: "90d" },
  { id: "g2", type: "velocity_trend", w: 1, chartType: "bar" },
  { id: "g3", type: "throughput", w: 1, chartType: "bar", range: "90d" },
  { id: "g4", type: "team_growth", w: 2, chartType: "bar", range: "90d" },
  { id: "g5", type: "open_vs_closed", w: 2 },
];

type Filters = {
  projects: string[];
  assignees: string[];
  lead: string;
  range: string;
  priority: string[];
};
const EMPTY_FILTERS: Filters = { projects: [], assignees: [], lead: "", range: "90d", priority: [] };

function buildQuery(f: { range: string; projects?: string[]; assignees?: string[]; lead?: string; priority?: string[] }) {
  const p = new URLSearchParams();
  if (f.projects?.length) p.set("projects", f.projects.join(","));
  if (f.assignees?.length) p.set("assignees", f.assignees.join(","));
  if (f.lead) p.set("lead", f.lead);
  if (f.priority?.length) p.set("priority", f.priority.join(","));
  p.set("range", f.range || "90d");
  return `/api/dashboards/data?${p.toString()}`;
}

/* --------------------------- Multi-select ---------------------------- */
function Multi({ label, options, value, onChange }: { label: string; options: { id: string; name: string; color?: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="relative">
      <button
        className={cn("flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm", value.length ? "border-accent text-accent" : "border-line bg-card")}
        onClick={() => setOpen((o) => !o)}
      >
        {label}{value.length > 0 && ` · ${value.length}`}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-lg">
            {options.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted">No options</p>}
            {options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-line/40">
                <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
                {o.color && <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />}
                <span className="truncate">{o.name}</span>
              </label>
            ))}
            {value.length > 0 && (
              <button className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-muted hover:bg-line/40" onClick={() => onChange([])}>Clear</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Filter bar ---------------------------- */
function FilterBar({ options, filters, onChange }: { options: Any; filters: Filters; onChange: (f: Filters) => void }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const projectOpts = (options?.projects || []).map((p: Any) => ({ id: String(p._id), name: p.name }));
  const peopleOpts = [{ id: "unassigned", name: "Unassigned" }, ...(options?.people || []).map((p: Any) => ({ id: p.id, name: p.name, color: p.color }))];
  const priorityOpts = PRIORITIES.map((p) => ({ id: p, name: PRIORITY_META[p].label, color: PRIORITY_META[p].color }));
  const active = filters.projects.length || filters.assignees.length || filters.lead || filters.priority.length || filters.range !== "90d";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card/50 p-2">
      <SlidersHorizontal size={15} className="ml-1 text-muted" />
      <Multi label="Projects" options={projectOpts} value={filters.projects} onChange={(v) => set({ projects: v })} />
      <Multi label="People" options={peopleOpts} value={filters.assignees} onChange={(v) => set({ assignees: v })} />
      <Multi label="Priority" options={priorityOpts} value={filters.priority} onChange={(v) => set({ priority: v })} />
      <select
        className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
        value={filters.lead}
        onChange={(e) => set({ lead: e.target.value })}
        title="Filter by project lead / owner"
      >
        <option value="">Any lead</option>
        {(options?.leads || []).map((l: Any) => <option key={l.id} value={l.id}>Lead: {l.name}</option>)}
      </select>
      <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm" value={filters.range} onChange={(e) => set({ range: e.target.value })} title="Date range (growth widgets)">
        {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      {active && (
        <button className="btn-ghost !py-1.5 text-xs text-muted" onClick={() => onChange(EMPTY_FILTERS)}>Clear all</button>
      )}
    </div>
  );
}

/* ---------------------------- Widget config -------------------------- */
function WidgetConfig({ w, options, onClose, onSave }: { w: Any; options: Any; onClose: () => void; onSave: (patch: Any) => void }) {
  const [draft, setDraft] = useState<Any>({
    chartType: w.chartType || (CHART_OPTIONS[w.type]?.[0] ?? null),
    range: w.range || "",
    projects: w.projects || [],
    assignees: w.assignees || [],
  });
  const charts = CHART_OPTIONS[w.type] || [];
  const projectOpts = (options?.projects || []).map((p: Any) => ({ id: String(p._id), name: p.name }));
  const peopleOpts = [{ id: "unassigned", name: "Unassigned" }, ...(options?.people || []).map((p: Any) => ({ id: p.id, name: p.name, color: p.color }))];

  return (
    <Modal open onClose={onClose} title={`Configure · ${WIDGET_LABELS[w.type] || w.type}`}>
      <div className="space-y-4">
        {charts.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Graph type</label>
            <div className="flex flex-wrap gap-1.5">
              {charts.map((c) => (
                <button
                  key={c}
                  className={cn("rounded-lg border px-3 py-1.5 text-sm capitalize", draft.chartType === c ? "border-accent text-accent" : "border-line")}
                  onClick={() => setDraft((d: Any) => ({ ...d, chartType: c }))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {RANGE_WIDGETS.has(w.type) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Date range (overrides the board filter)</label>
            <select className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm" value={draft.range} onChange={(e) => setDraft((d: Any) => ({ ...d, range: e.target.value }))}>
              <option value="">Follow board filter</option>
              {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Projects override</label>
          <Multi label="Projects" options={projectOpts} value={draft.projects} onChange={(v) => setDraft((d: Any) => ({ ...d, projects: v }))} />
          <p className="mt-1 text-[11px] text-muted">Empty = follow the board filter.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">People override</label>
          <Multi label="People" options={peopleOpts} value={draft.assignees} onChange={(v) => setDraft((d: Any) => ({ ...d, assignees: v }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              onSave({
                chartType: draft.chartType || null,
                range: draft.range || null,
                projects: draft.projects,
                assignees: draft.assignees,
              });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- Widget ------------------------------ */
function Widget({ w, filters, editing, onRemove, onResize, onConfigure }: { w: Any; filters: Filters; editing: boolean; onRemove: () => void; onResize: () => void; onConfigure: () => void }) {
  // Effective query: widget overrides win over the global filter.
  const range = (RANGE_WIDGETS.has(w.type) ? w.range || filters.range : filters.range) || "90d";
  const projects = w.projects?.length ? w.projects : filters.projects;
  const assignees = w.assignees?.length ? w.assignees : filters.assignees;
  const query = buildQuery({ range, projects, assignees, lead: filters.lead, priority: filters.priority });
  const { data } = useQ.useDashboardData(query, { pollingInterval: 60000 });
  const chart = w.chartType || (CHART_OPTIONS[w.type]?.[0] ?? null);

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
        if (chart === "bar") {
          return (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={entries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {entries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        }
        return (
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={entries} dataKey="value" nameKey="name" innerRadius={chart === "donut" ? 45 : 0} outerRadius={70} paddingAngle={2}>
                  {entries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
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
                <Tooltip contentStyle={TT} />
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
      case "project_growth": {
        const g = data.growth || [];
        if (!g.length) return <p className="py-6 text-center text-sm text-muted">No data in range.</p>;
        const series = [
          { key: "created", color: "#6366f1", label: "Created" },
          { key: "completed", color: "#22c55e", label: "Completed" },
          { key: "open", color: "#eab308", label: "Open" },
        ];
        return (
          <div className="h-64">
            <ResponsiveContainer>
              {chart === "bar" ? (
                <BarChart data={g}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />)}
                </BarChart>
              ) : chart === "line" ? (
                <LineChart data={g}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={2} />)}
                </LineChart>
              ) : (
                <AreaChart data={g}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((s) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} />)}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      }
      case "throughput": {
        const th = data.throughput || [];
        if (!th.length) return <p className="py-6 text-center text-sm text-muted">No data in range.</p>;
        return (
          <div className="h-64">
            <ResponsiveContainer>
              {chart === "line" ? (
                <LineChart data={th}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              ) : chart === "area" ? (
                <AreaChart data={th}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                </AreaChart>
              ) : (
                <BarChart data={th}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      }
      case "velocity_trend": {
        const v = data.velocity || [];
        if (!v.length) return <p className="py-6 text-center text-sm text-muted">No completed sprints yet.</p>;
        return (
          <div className="h-64">
            <ResponsiveContainer>
              {chart === "line" ? (
                <LineChart data={v}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="committed" name="Committed" stroke="#94a3b8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={v}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="committed" name="Committed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      }
      case "team_growth": {
        const tg = data.teamGrowth || { people: [], rows: [] };
        if (!tg.rows.length || !tg.people.length) return <p className="py-6 text-center text-sm text-muted">No completed work in range.</p>;
        return (
          <div className="h-64">
            <ResponsiveContainer>
              {chart === "line" ? (
                <LineChart data={tg.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {tg.people.map((p: Any, i: number) => <Line key={p.name} type="monotone" dataKey={p.name} stroke={p.color || PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />)}
                </LineChart>
              ) : (
                <BarChart data={tg.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {tg.people.map((p: Any, i: number) => <Bar key={p.name} dataKey={p.name} stackId="t" fill={p.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const hasOverride = w.projects?.length || w.assignees?.length || w.range;
  return (
    <div className={cn("card p-4", w.w === 2 && "md:col-span-2")}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {WIDGET_LABELS[w.type] || w.type}
          {hasOverride && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-normal text-accent" title="This widget has its own filters">scoped</span>}
        </h3>
        {editing && (
          <div className="flex gap-1">
            <button className="btn-ghost !p-1 text-muted" onClick={onConfigure} title="Configure"><Settings2 size={13} /></button>
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
  const { data: dashData } = useQ.useDashboards();
  const [saveDashboard] = useSaveDashboardMutation();
  const [deleteDashboardM] = useDeleteDashboardMutation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const dashboards: Any[] = dashData?.dashboards || [];
  const dash = dashboards.find((d) => d._id === activeId) || dashboards[0];

  // Load the active dashboard's saved filter scope when switching boards. This
  // uses the render-phase guarded-setState pattern (same as useSwrLike in the
  // store) rather than an effect, so the filters are correct on first paint.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (dash && dash._id !== loadedFor) {
    setLoadedFor(dash._id);
    const f = dash.filters || {};
    setFilters({
      projects: (f.projects || []).map(String),
      assignees: f.assignees || [],
      lead: f.lead || "",
      range: f.range || "90d",
      priority: f.priority || [],
    });
  }

  // Page-level fetch drives the filter-bar option lists (and dedupes with any
  // override-free widget that uses the same global query).
  const { data: options } = useQ.useDashboardData(dash ? buildQuery(filters) : null, { pollingInterval: 60000 });

  async function saveWidgets(widgets: Any[]) {
    await saveDashboard({ _id: dash._id, name: dash.name, widgets, filters }).unwrap();
  }
  function changeFilters(next: Filters) {
    setFilters(next);
    if (dash) saveDashboard({ _id: dash._id, name: dash.name, widgets: dash.widgets, filters: next }); // persist scope (fire-and-forget)
  }
  async function createDashboard(name: string, widgets: Any[]) {
    const res = await saveDashboard({ name, widgets }).unwrap();
    setActiveId(res.dashboard._id);
    setNewOpen(false);
  }
  async function deleteDashboard() {
    if (!confirm(`Delete dashboard "${dash.name}"?`)) return;
    await deleteDashboardM(dash._id).unwrap();
    setActiveId(null);
  }

  if (!dashData) return <Spinner label="Loading dashboard…" />;

  const configW = dash?.widgets.find((x: Any) => x.id === configId);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        {dashboards.length > 0 && (
          <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm" value={dash?._id || ""} onChange={(e) => setActiveId(e.target.value)}>
            {dashboards.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => setNewOpen(true)}><Plus size={13} /> New dashboard</button>
          {dashboards.length > 1 && editing && (
            <button className="btn-ghost !py-1.5 text-xs text-red-500" onClick={deleteDashboard}><Trash2 size={13} /></button>
          )}
          <button className={cn("btn-ghost !py-1.5 text-xs", editing && "!border-accent text-accent")} onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Customize"}
          </button>
        </div>
      </div>

      {dash && <FilterBar options={options} filters={filters} onChange={changeFilters} />}

      {dash && dash.widgets.length === 0 && (
        <EmptyState icon={<LayoutDashboard size={40} />} title="Empty dashboard" hint="Add widgets to see your work at a glance."
          action={<button className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add widget</button>} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {dash?.widgets.map((w: Any) => (
          <Widget
            key={w.id}
            w={w}
            filters={filters}
            editing={editing}
            onConfigure={() => setConfigId(w.id)}
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

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New dashboard">
        <div className="space-y-2">
          <button
            className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-accent"
            onClick={() => { const n = prompt("Dashboard name:"); if (n) createDashboard(n, [{ id: "w1", type: "assigned_to_me", w: 1 }]); }}
          >
            <LayoutDashboard size={18} className="text-muted" />
            <div><div className="text-sm font-medium">Blank dashboard</div><div className="text-xs text-muted">Start empty and add your own widgets.</div></div>
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-accent"
            onClick={() => createDashboard("Team Growth", TEAM_GROWTH_TEMPLATE)}
          >
            <TrendingUp size={18} className="text-accent" />
            <div><div className="text-sm font-medium">Team Growth template</div><div className="text-xs text-muted">Project growth, velocity, throughput & per-person trends.</div></div>
          </button>
        </div>
      </Modal>

      {configW && (
        <WidgetConfig
          w={configW}
          options={options}
          onClose={() => setConfigId(null)}
          onSave={(patch) => saveWidgets(dash.widgets.map((x: Any) => (x.id === configW.id ? { ...x, ...patch } : x)))}
        />
      )}
    </div>
  );
}
