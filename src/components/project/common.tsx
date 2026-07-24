"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Filter, X, Save } from "lucide-react";
import { fetcher, api } from "@/lib/client";
import { Avatar, TypeIcon, PriorityBadge } from "@/components/ui";
import { PRIORITIES, PRIORITY_META, TASK_TYPES, TYPE_META } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

/* ------------------------------ data hooks ----------------------------- */
export function useProject(projectId: string) {
  const { data, mutate } = useSWR<Any>(projectId ? `/api/projects/${projectId}` : null, fetcher);
  return {
    project: data?.project,
    myRole: data?.myRole,
    myCapabilities: (data?.myCapabilities || []) as string[],
    mutate,
  };
}

export interface TaskFilters {
  q: string;
  assignee: string[];
  priority: string[];
  type: string[];
  label: string[];
  status: string[];
}

export const emptyFilters: TaskFilters = { q: "", assignee: [], priority: [], type: [], label: [], status: [] };

export function filtersToQuery(f: TaskFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.assignee.length) p.set("assignee", f.assignee.join(","));
  if (f.priority.length) p.set("priority", f.priority.join(","));
  if (f.type.length) p.set("type", f.type.join(","));
  if (f.label.length) p.set("label", f.label.join(","));
  if (f.status.length) p.set("status", f.status.join(","));
  const s = p.toString();
  return s ? `&${s}` : "";
}

/* ------------------------------- FilterBar ----------------------------- */
function MultiSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className={cn("btn-ghost !py-1.5 text-xs", value.length > 0 && "!border-accent text-accent")}
        onClick={() => setOpen((o) => !o)}
      >
        {label}{value.length > 0 && ` (${value.length})`}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 max-h-64 w-52 overflow-y-auto card p-1 shadow-xl">
            {options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-line/40">
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
                  }
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FilterBar({
  project, filters, setFilters, extra,
}: {
  project: Any;
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
  extra?: React.ReactNode;
}) {
  const members = project?.members || [];
  const hasFilters =
    filters.q || filters.assignee.length || filters.priority.length || filters.type.length || filters.label.length || filters.status.length;
  const { data: savedData, mutate: mutSaved } = useSWR<Any>(project?._id ? `/api/filters?project=${project._id}` : null, fetcher);

  async function saveCurrent() {
    const name = prompt("Name this filter:");
    if (!name) return;
    await api("/api/filters", "POST", { name, project: project._id, filters });
    mutSaved();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Filter size={14} className="text-muted" />
      <input
        className="input !w-44 !py-1.5 text-xs"
        placeholder="Search tasks…"
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
      />
      <MultiSelect
        label="Assignee"
        options={[{ value: "none", label: "Unassigned" }, ...members.map((m: Any) => ({ value: m.user._id, label: m.user.name }))]}
        value={filters.assignee}
        onChange={(assignee) => setFilters({ ...filters, assignee })}
      />
      <MultiSelect
        label="Priority"
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
        value={filters.priority}
        onChange={(priority) => setFilters({ ...filters, priority })}
      />
      <MultiSelect
        label="Type"
        options={TASK_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }))}
        value={filters.type}
        onChange={(type) => setFilters({ ...filters, type })}
      />
      <MultiSelect
        label="Label"
        options={(project?.labels || []).map((l: Any) => ({ value: l.id, label: l.name }))}
        value={filters.label}
        onChange={(label) => setFilters({ ...filters, label })}
      />
      {(savedData?.filters || []).length > 0 && (
        <select
          className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs"
          value=""
          onChange={(e) => {
            const f = savedData.filters.find((x: Any) => x._id === e.target.value);
            if (f) setFilters({ ...emptyFilters, ...f.filters });
          }}
        >
          <option value="">Saved filters…</option>
          {savedData.filters.map((f: Any) => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
      )}
      {hasFilters && (
        <>
          <button className="btn-ghost !py-1.5 text-xs" onClick={saveCurrent} title="Save filter"><Save size={12} /></button>
          <button className="btn-ghost !py-1.5 text-xs text-muted" onClick={() => setFilters(emptyFilters)}>
            <X size={12} /> Clear
          </button>
        </>
      )}
      {extra}
    </div>
  );
}

/* -------------------------------- TaskCard ----------------------------- */
export function TaskCard({
  task, onClick, selected, onToggleSelect, showStatus, statuses,
}: {
  task: Any;
  onClick: () => void;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  showStatus?: boolean;
  statuses?: Any[];
}) {
  const status = statuses?.find((s) => s.id === task.status);
  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:border-accent",
        selected ? "border-accent ring-1 ring-accent" : "border-line"
      )}
    >
      <div className="mb-1.5 flex items-start gap-1.5">
        <TypeIcon type={task.type} size={13} />
        <span className="min-w-0 flex-1 text-sm leading-snug">{task.title}</span>
        {onToggleSelect && (
          <input
            type="checkbox"
            className={cn("mt-0.5 shrink-0", !selected && "opacity-0 group-hover:opacity-100")}
            checked={!!selected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {}}
            onClickCapture={(e) => { e.stopPropagation(); onToggleSelect(e as React.MouseEvent); }}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted">{task.key}</span>
        {showStatus && status && (
          <span className="chip !text-[10px]" style={{ background: `${status.color}22`, color: status.color }}>{status.name}</span>
        )}
        <PriorityBadge priority={task.priority} compact />
        {task.storyPoints != null && (
          <span className="chip bg-line/60 text-muted !text-[10px]">{task.storyPoints} pts</span>
        )}
        {task.dueDate && (
          <span className={cn("text-[10px]", isOverdue(task.dueDate) ? "text-red-500 font-medium" : "text-muted")}>
            {formatDate(task.dueDate)}
          </span>
        )}
        <span className="ml-auto"><Avatar user={task.assignee} size={20} /></span>
      </div>
    </div>
  );
}

/* ------------------------------ BulkActions ---------------------------- */
export function BulkBar({
  project, selected, clear, onDone,
}: {
  project: Any;
  selected: string[];
  clear: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const members = project?.members || [];
  const { data: sprintData } = useSWR<Any>(project?._id ? `/api/sprints?project=${project._id}` : null, fetcher);

  const apply = async (set: Any) => {
    setBusy(true);
    try {
      await api("/api/tasks/bulk", "PATCH", { taskIds: selected, set });
      onDone(); clear();
    } finally { setBusy(false); }
  };

  const selCls = "rounded border border-line bg-card px-2 py-1 text-xs";
  if (selected.length === 0) return null;
  return (
    <div className="sticky bottom-3 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 card px-4 py-2.5 shadow-2xl">
      <span className="text-sm font-medium">{selected.length} selected</span>
      <select className={selCls} disabled={busy} defaultValue="" onChange={(e) => e.target.value && apply({ status: e.target.value })}>
        <option value="">Status…</option>
        {(project?.statuses || []).map((s: Any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className={selCls} disabled={busy} defaultValue="" onChange={(e) => e.target.value && apply({ priority: e.target.value })}>
        <option value="">Priority…</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
      </select>
      <select className={selCls} disabled={busy} defaultValue="" onChange={(e) => e.target.value && apply({ assignee: e.target.value === "none" ? null : e.target.value })}>
        <option value="">Assign…</option>
        <option value="none">Unassigned</option>
        {members.map((m: Any) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
      </select>
      <select className={selCls} disabled={busy} defaultValue="" onChange={(e) => e.target.value && apply({ sprint: e.target.value === "none" ? null : e.target.value })}>
        <option value="">Sprint…</option>
        <option value="none">Backlog</option>
        {(sprintData?.sprints || []).filter((s: Any) => s.status !== "completed").map((s: Any) => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>
      <button className="btn-ghost !py-1 text-xs" disabled={busy} onClick={() => apply({ archived: true })}>Archive</button>
      <button className="btn-ghost !py-1 text-xs text-muted" onClick={clear}><X size={12} /></button>
    </div>
  );
}

/* ---------------------------- ProjectHeader ---------------------------- */
export function ProjectHeader({ project, title, children }: { project: Any; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div>
        <div className="text-xs text-muted">{project?.workspace?.name} / <span className="font-mono">{project?.key}</span></div>
        <h1 className="text-lg font-bold leading-tight">{project?.name} <span className="font-normal text-muted">· {title}</span></h1>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* Group tasks client-side (swimlanes / grouping). */
export function useGroups(tasks: Any[], groupBy: string, project: Any) {
  return useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", tasks }];
    const groups = new Map<string, { key: string; label: string; tasks: Any[] }>();
    const push = (key: string, label: string, t: Any) => {
      if (!groups.has(key)) groups.set(key, { key, label, tasks: [] });
      groups.get(key)!.tasks.push(t);
    };
    for (const t of tasks) {
      if (groupBy === "assignee") push(t.assignee?._id || "none", t.assignee?.name || "Unassigned", t);
      else if (groupBy === "priority") push(t.priority, PRIORITY_META[t.priority as keyof typeof PRIORITY_META]?.label || t.priority, t);
      else if (groupBy === "sprint") push(t.sprint?._id || "none", t.sprint?.name || "No sprint", t);
      else if (groupBy === "epic") push(t.epic?._id || "none", t.epic ? `${t.epic.key} ${t.epic.title}` : "No epic", t);
      else if (groupBy === "type") push(t.type, TYPE_META[t.type as keyof typeof TYPE_META]?.label || t.type, t);
      else if (groupBy === "status") {
        const s = (project?.statuses || []).find((x: Any) => x.id === t.status);
        push(t.status, s?.name || t.status, t);
      }
    }
    return [...groups.values()];
  }, [tasks, groupBy, project]);
}
