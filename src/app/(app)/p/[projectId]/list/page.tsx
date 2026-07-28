"use client";

import { use, useMemo, useState } from "react";
import { ArrowUpDown, Plus } from "lucide-react";
import { api } from "@/store/api";
import { useQ, useAppDispatch, useCreateTaskMutation, useUpdateTaskMutation } from "@/store/hooks";
import { Spinner, Avatar, TypeIcon } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import {
  useProject, FilterBar, BulkBar, ProjectHeader, emptyFilters, filtersToQuery, useGroups,
  type TaskFilters, type Any,
} from "@/components/project/common";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";

const COLUMNS = [
  { id: "key", label: "Key" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "assignee", label: "Assignee" },
  { id: "storyPoints", label: "Points" },
  { id: "sprint", label: "Sprint" },
  { id: "dueDate", label: "Due" },
];

export default function ListPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [sort, setSort] = useState("-createdAt");
  const [groupBy, setGroupBy] = useState("none");
  const [selected, setSelected] = useState<string[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(COLUMNS.map((c) => c.id));
  const [newTitle, setNewTitle] = useState("");
  const [page, setPage] = useState(1);

  const dispatch = useAppDispatch();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();

  const url = `/api/tasks?project=${projectId}&sort=${sort}&page=${page}&limit=50${filtersToQuery(filters)}`;
  const { data, mutate, isLoading } = useQ.useTasks(url);
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);
  const statuses: Any[] = project?.statuses || [];
  const groups = useGroups(tasks, groupBy, project);

  const toggleSort = (col: string) => {
    const field = col === "assignee" ? "assignee" : col;
    setSort((s) => (s === field ? `-${field}` : field));
  };

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await createTask({ project: projectId, title: newTitle.trim() }).unwrap();
    setNewTitle("");
    // If the project marks fields as required, open the new task so they can be filled.
    if (res?.task?._id && project?.requiredFields?.length) setOpenTask(res.task._id);
  }

  async function inlinePatch(taskId: string, set: Any) {
    // optimistic — the row's cell reflects the change instantly.
    const patch = dispatch(
      api.util.updateQueryData("getTasks", url, (draft: Any) => {
        const t = draft?.tasks?.find((x: Any) => x._id === taskId);
        if (t) Object.assign(t, set);
      })
    );
    try {
      await updateTask({ id: taskId, set }).unwrap();
    } catch {
      patch.undo();
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const show = (c: string) => visibleCols.includes(c);
  const cellSelect = "w-full bg-transparent text-xs rounded border border-transparent hover:border-line px-1 py-0.5 cursor-pointer outline-none";

  if (!project) return <Spinner label="Loading list…" />;

  return (
    <div className="p-5">
      <ProjectHeader project={project} title="List">
        <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="none">No grouping</option>
          <option value="status">Group: Status</option>
          <option value="assignee">Group: Assignee</option>
          <option value="priority">Group: Priority</option>
          <option value="sprint">Group: Sprint</option>
          <option value="epic">Group: Epic</option>
          <option value="type">Group: Type</option>
        </select>
        <details className="relative">
          <summary className="btn-ghost !py-1.5 text-xs cursor-pointer list-none">Columns</summary>
          <div className="absolute right-0 z-40 mt-1 w-44 card p-1 shadow-xl">
            {COLUMNS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-line/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={show(c.id)}
                  onChange={(e) => setVisibleCols((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))}
                />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      </ProjectHeader>

      <div className="mb-3">
        <FilterBar project={project} filters={filters} setFilters={setFilters} />
      </div>

      <form onSubmit={quickAdd} className="mb-3 flex gap-2">
        <input className="input !py-1.5 text-sm" placeholder="Quick add a task…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <button className="btn-primary !py-1.5" disabled={!newTitle.trim()}><Plus size={14} /></button>
      </form>

      {isLoading && !data ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.length > 0 && selected.length === tasks.length}
                    onChange={(e) => setSelected(e.target.checked ? tasks.map((t) => t._id) : [])}
                  />
                </th>
                {COLUMNS.filter((c) => show(c.id)).map((c) => (
                  <th key={c.id} className="px-3 py-2">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.id)}>
                      {c.label} <ArrowUpDown size={11} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key}>
                {groupBy !== "none" && (
                  <tr className="border-b border-line bg-background/60">
                    <td colSpan={1 + visibleCols.length} className="px-3 py-1.5 text-xs font-semibold text-muted">
                      {g.label} ({g.tasks.length})
                    </td>
                  </tr>
                )}
                {g.tasks.map((t: Any) => (
                  <tr key={t._id} className={cn("border-b border-line hover:bg-line/20 cursor-pointer", selected.includes(t._id) && "bg-accent/10")} onClick={() => setOpenTask(t._id)}>
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggleSelect(t._id)} />
                    </td>
                    {show("key") && (
                      <td className="px-3 py-1.5 font-mono text-xs text-muted whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><TypeIcon type={t.type} size={11} />{t.key}</span>
                      </td>
                    )}
                    {show("title") && <td className="px-3 py-1.5 max-w-md truncate">{t.title}</td>}
                    {show("status") && (
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <select className={cellSelect} value={t.status} onChange={(e) => inlinePatch(t._id, { status: e.target.value })}>
                          {statuses.map((s: Any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                    )}
                    {show("priority") && (
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <select className={cellSelect} value={t.priority} onChange={(e) => inlinePatch(t._id, { priority: e.target.value })}>
                          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                        </select>
                      </td>
                    )}
                    {show("assignee") && (
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center gap-1.5">
                          <Avatar user={t.assignee} size={18} />
                          <select className={cellSelect} value={t.assignee?._id || ""} onChange={(e) => inlinePatch(t._id, { assignee: e.target.value || null })}>
                            <option value="">Unassigned</option>
                            {(project.members || []).map((m: Any) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
                          </select>
                        </span>
                      </td>
                    )}
                    {show("storyPoints") && <td className="px-3 py-1.5 text-xs text-muted">{t.storyPoints ?? "–"}</td>}
                    {show("sprint") && <td className="px-3 py-1.5 text-xs text-muted whitespace-nowrap">{t.sprint?.name || "Backlog"}</td>}
                    {show("dueDate") && (
                      <td className={cn("px-3 py-1.5 text-xs whitespace-nowrap", isOverdue(t.dueDate) ? "text-red-500 font-medium" : "text-muted")}>
                        {t.dueDate ? formatDate(t.dueDate) : "–"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          {tasks.length === 0 && <p className="py-10 text-center text-sm text-muted">No tasks match the current filters.</p>}
          {data?.pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
              <span>{data.total} tasks · page {data.page} of {data.pages}</span>
              <span className="flex gap-2">
                <button className="btn-ghost !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <button className="btn-ghost !py-1 text-xs" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </span>
            </div>
          )}
        </div>
      )}

      <BulkBar project={project} selected={selected} clear={() => setSelected([])} onDone={() => mutate()} />
      {openTask && <TaskModal taskId={openTask} project={project} onClose={() => setOpenTask(null)} onChanged={() => mutate()} />}
    </div>
  );
}
