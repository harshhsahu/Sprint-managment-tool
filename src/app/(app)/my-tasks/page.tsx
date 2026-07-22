"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { Spinner, TypeIcon, PriorityBadge, EmptyState } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import { ListChecks } from "lucide-react";
import { cn, formatDate, isOverdue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export default function MyTasksPage() {
  const [scope, setScope] = useState<"assignee" | "reporter">("assignee");
  const [openTask, setOpenTask] = useState<Any>(null);
  const url = `/api/tasks?${scope}=me&sort=dueDate&limit=100`;
  const { data, mutate, isLoading } = useSWR<Any>(url, fetcher, { keepPreviousData: true });
  const { data: projData } = useSWR<Any>("/api/projects", fetcher);
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);
  const projects: Any[] = projData?.projects || [];

  const byProject = useMemo(() => {
    const map = new Map<string, Any[]>();
    for (const t of tasks) {
      const pid = String(t.project);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(t);
    }
    return map;
  }, [tasks]);

  const openTaskProject = openTask ? projects.find((p) => p._id === String(openTask.project)) : null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold">My Tasks</h1>
        <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm" value={scope} onChange={(e) => setScope(e.target.value as Any)}>
          <option value="assignee">Assigned to me</option>
          <option value="reporter">Reported by me</option>
        </select>
        <span className="ml-auto text-sm text-muted">{data?.total ?? 0} tasks</span>
      </div>

      {isLoading && !data ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <EmptyState icon={<ListChecks size={40} />} title="No tasks here" hint="Tasks assigned to you across all projects will show up here." />
      ) : (
        <div className="space-y-5">
          {[...byProject.entries()].map(([pid, list]) => {
            const project = projects.find((p) => p._id === pid);
            const statuses = project?.statuses || [];
            return (
              <div key={pid} className="card overflow-hidden">
                <div className="border-b border-line bg-background/50 px-4 py-2 text-sm font-semibold">
                  {project?.name || "Project"} <span className="font-mono text-xs text-muted">{project?.key}</span>
                </div>
                {list.map((t) => {
                  const st = statuses.find((s: Any) => s.id === t.status);
                  return (
                    <button key={t._id} onClick={() => setOpenTask(t)} className="flex w-full items-center gap-2.5 border-b border-line px-4 py-2.5 text-left text-sm last:border-0 hover:bg-line/30">
                      <TypeIcon type={t.type} size={12} />
                      <span className="font-mono text-xs text-muted">{t.key}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {st && <span className="chip !text-[10px]" style={{ background: `${st.color}22`, color: st.color }}>{st.name}</span>}
                      <PriorityBadge priority={t.priority} compact />
                      {t.dueDate && (
                        <span className={cn("text-xs", isOverdue(t.dueDate) ? "font-semibold text-red-500" : "text-muted")}>{formatDate(t.dueDate)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {openTask && openTaskProject && (
        <TaskModal taskId={openTask._id} project={openTaskProject} onClose={() => setOpenTask(null)} onChanged={() => mutate()} />
      )}
    </div>
  );
}
