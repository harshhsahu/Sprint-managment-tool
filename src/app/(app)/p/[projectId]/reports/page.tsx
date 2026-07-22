"use client";

import { use, useState } from "react";
import useSWR from "swr";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fetcher } from "@/lib/client";
import { Spinner, Avatar } from "@/components/ui";
import { useProject, ProjectHeader, type Any } from "@/components/project/common";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#6366f1", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#8b5cf6", "#f97316", "#64748b"];

function ChartCard({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      {subtitle && <p className="mb-2 text-xs text-muted">{subtitle}</p>}
      <div className="h-64">{children}</div>
    </div>
  );
}

const TABS = [
  { id: "sprint", label: "Sprint Reports" },
  { id: "project", label: "Project Reports" },
  { id: "flow", label: "Flow Metrics" },
] as const;

export default function ReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sprint");
  const [burndownSprint, setBurndownSprint] = useState("");

  const { data: sprintList } = useSWR<Any>(`/api/sprints?project=${projectId}&archived=1`, fetcher);
  const { data: velocity } = useSWR<Any>(tab === "sprint" ? `/api/reports/${projectId}?type=velocity` : null, fetcher);
  const { data: burn } = useSWR<Any>(
    tab === "sprint" ? `/api/reports/${projectId}?type=burndown${burndownSprint ? `&sprint=${burndownSprint}` : ""}` : null,
    fetcher
  );
  const { data: dist } = useSWR<Any>(tab === "project" ? `/api/reports/${projectId}?type=distribution` : null, fetcher);
  const { data: aging } = useSWR<Any>(tab === "project" ? `/api/reports/${projectId}?type=aging` : null, fetcher);
  const { data: flow } = useSWR<Any>(tab === "flow" ? `/api/reports/${projectId}?type=flow` : null, fetcher);

  if (!project) return <Spinner label="Loading reports…" />;

  const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

  return (
    <div className="mx-auto max-w-6xl p-5">
      <ProjectHeader project={project} title="Reports & Analytics" />
      <div className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px", tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sprint" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Velocity" subtitle="Committed vs completed story points per sprint">
            {velocity ? (
              velocity.velocity.length === 0 ? <p className="pt-16 text-center text-sm text-muted">Complete a sprint to see velocity.</p> :
              <ResponsiveContainer>
                <BarChart data={velocity.velocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="committed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Spinner />}
          </ChartCard>

          <ChartCard
            title={`Burndown${burn?.sprint ? ` — ${burn.sprint.name}` : ""}`}
            subtitle="Remaining story points vs ideal"
          >
            <div className="mb-2 -mt-1">
              <select className="rounded border border-line bg-card px-2 py-1 text-xs" value={burndownSprint} onChange={(e) => setBurndownSprint(e.target.value)}>
                <option value="">Active sprint</option>
                {(sprintList?.sprints || []).filter((s: Any) => s.startDate).map((s: Any) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.status})</option>
                ))}
              </select>
            </div>
            {burn ? (
              burn.burndown.length === 0 ? <p className="pt-12 text-center text-sm text-muted">Start a sprint with dates to see the burndown.</p> :
              <ResponsiveContainer height="88%">
                <LineChart data={burn.burndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="6 4" dot={false} />
                  <Line type="monotone" dataKey="remaining" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Spinner />}
          </ChartCard>

          <ChartCard title="Burnup" subtitle="Completed points vs total scope (scope change visible)">
            {burn ? (
              (burn.burnup || []).length === 0 ? <p className="pt-16 text-center text-sm text-muted">No data yet.</p> :
              <ResponsiveContainer>
                <AreaChart data={burn.burnup}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="scope" stroke="#94a3b8" fill="#94a3b833" />
                  <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="#22c55e33" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Spinner />}
          </ChartCard>

          <div className="card p-4">
            <h3 className="mb-2 font-semibold text-sm">Sprint completion</h3>
            <div className="space-y-2 overflow-y-auto max-h-64">
              {(velocity?.velocity || []).map((v: Any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate">{v.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${v.committed ? Math.min(100, (v.completed / v.committed) * 100) : 0}%` }} />
                  </div>
                  <span className="w-24 text-right text-xs text-muted">
                    {v.completed}/{v.committed} pts ({v.committed ? Math.round((v.completed / v.committed) * 100) : 0}%)
                  </span>
                </div>
              ))}
              {(velocity?.velocity || []).length === 0 && <p className="text-sm text-muted">No completed sprints yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "project" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(["byStatus", "byType", "byPriority", "byAssignee"] as const).map((k) => (
            <ChartCard key={k} title={{ byStatus: "Tasks by Status", byType: "Tasks by Type", byPriority: "Tasks by Priority", byAssignee: "Workload by Assignee" }[k]}>
              {dist ? (
                (dist[k] || []).length === 0 ? <p className="pt-16 text-center text-sm text-muted">No tasks yet.</p> :
                k === "byAssignee" ? (
                  <ResponsiveContainer>
                    <BarChart data={dist[k]} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={dist[k]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {dist[k].map((_: Any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              ) : <Spinner />}
            </ChartCard>
          ))}

          <div className="card p-4 lg:col-span-2">
            <h3 className="mb-1 font-semibold text-sm">Aging & blocked tasks</h3>
            <p className="mb-3 text-xs text-muted">Oldest open tasks — blocked ones are flagged.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="py-1.5 pr-3">Key</th><th className="py-1.5 pr-3">Title</th><th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 pr-3">Assignee</th><th className="py-1.5 pr-3">Age</th><th className="py-1.5">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {(aging?.aging || []).map((t: Any) => (
                    <tr key={t._id} className="border-b border-line">
                      <td className="py-1.5 pr-3 font-mono text-xs text-muted">{t.key}</td>
                      <td className="max-w-sm truncate py-1.5 pr-3">{t.title}</td>
                      <td className="py-1.5 pr-3 text-xs">{t.status}</td>
                      <td className="py-1.5 pr-3"><span className="flex items-center gap-1.5 text-xs"><Avatar user={t.assignee} size={18} />{t.assignee?.name || "—"}</span></td>
                      <td className={cn("py-1.5 pr-3 text-xs", t.ageDays > 30 ? "text-red-500 font-medium" : "text-muted")}>{t.ageDays}d</td>
                      <td className="py-1.5 text-xs">{t.blocked ? <span className="chip bg-red-500/15 text-red-500">Blocked</span> : "—"}</td>
                    </tr>
                  ))}
                  {(aging?.aging || []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No open tasks 🎉</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "flow" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 lg:col-span-2 sm:grid-cols-4">
            {[
              { label: "Avg cycle time", value: `${flow?.avgCycleDays ?? "–"} d`, hint: "start → done" },
              { label: "Avg lead time", value: `${flow?.avgLeadDays ?? "–"} d`, hint: "created → done" },
              { label: "Throughput (8w)", value: (flow?.throughput || []).reduce((a: number, w: Any) => a + w.count, 0), hint: "tasks completed" },
              { label: "Completed sample", value: (flow?.recent || []).length, hint: "recent done tasks" },
            ].map((s, i) => (
              <div key={i} className="card p-4">
                <div className="text-xs text-muted">{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted">{s.hint}</div>
              </div>
            ))}
          </div>
          <ChartCard title="Throughput" subtitle="Tasks completed per week">
            {flow ? (
              <ResponsiveContainer>
                <BarChart data={flow.throughput}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Spinner />}
          </ChartCard>
          <ChartCard title="Cumulative Flow" subtitle="Task states over the last 30 days">
            {flow ? (
              <ResponsiveContainer>
                <AreaChart data={flow.cfd}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="done" stackId="1" stroke="#22c55e" fill="#22c55e55" />
                  <Area type="monotone" dataKey="in_progress" stackId="1" stroke="#eab308" fill="#eab30855" />
                  <Area type="monotone" dataKey="todo" stackId="1" stroke="#94a3b8" fill="#94a3b855" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Spinner />}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
