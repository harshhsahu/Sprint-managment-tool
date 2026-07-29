"use client";

import { use, useMemo, useState } from "react";
import { useQ } from "@/store/hooks";
import { Spinner, TypeIcon, EmptyState } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import { useProject, ProjectHeader, type Any } from "@/components/project/common";
import { resolveTaskType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { GanttChartSquare } from "lucide-react";

/** Timeline / roadmap: epics and their tasks laid out by created→due dates across weeks. */
export default function TimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [scope, setScope] = useState<"epics" | "all">("epics");

  const { data, mutate, isLoading } = useQ.useTasks(`/api/tasks?project=${projectId}&limit=200&sort=createdAt`);
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);
  const { data: sprintData } = useQ.useSprints(`/api/sprints?project=${projectId}`);
  const sprints: Any[] = sprintData?.sprints || [];

  const rows = useMemo(() => {
    const epics = tasks.filter((t) => t.type === "epic");
    if (scope === "epics" && epics.length > 0) {
      return epics.map((e) => ({
        task: e,
        children: tasks.filter((t) => t.epic?._id === e._id),
      }));
    }
    return tasks.filter((t) => t.dueDate || t.type === "epic").map((t) => ({ task: t, children: [] as Any[] }));
  }, [tasks, scope]);

  // time window: min created → max due (or +30d)
  const { start, days } = useMemo(() => {
    const dates = tasks.flatMap((t) => [new Date(t.createdAt), t.dueDate ? new Date(t.dueDate) : null]).filter(Boolean) as Date[];
    for (const s of sprints) {
      if (s.startDate) dates.push(new Date(s.startDate));
      if (s.endDate) dates.push(new Date(s.endDate));
    }
    const min = dates.length ? new Date(Math.min(...dates.map(Number))) : new Date();
    const max = dates.length ? new Date(Math.max(...dates.map(Number))) : new Date();
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 7);
    const nDays = Math.max(14, Math.ceil((+max - +min) / 86400000));
    return { start: min, days: nDays };
  }, [tasks, sprints]);

  const pct = (d: Date) => Math.min(100, Math.max(0, ((+d - +start) / (days * 86400000)) * 100));

  const barFor = (t: Any) => {
    const s = new Date(t.createdAt);
    const e = t.dueDate ? new Date(t.dueDate) : new Date(+s + 7 * 86400000);
    const left = pct(s);
    const width = Math.max(1.5, pct(e) - left);
    return { left: `${left}%`, width: `${width}%` };
  };

  // month markers
  const months = useMemo(() => {
    const ms: { label: string; left: number }[] = [];
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (+d < +start + days * 86400000) {
      if (+d >= +start) ms.push({ label: d.toLocaleDateString(undefined, { month: "short" }), left: pct(d) });
      d.setMonth(d.getMonth() + 1);
    }
    return ms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, days]);

  const todayLeft = pct(new Date());

  if (!project) return <Spinner label="Loading timeline…" />;

  return (
    <div className="p-5">
      <ProjectHeader project={project} title="Timeline">
        <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs" value={scope} onChange={(e) => setScope(e.target.value as "epics" | "all")}>
          <option value="epics">Roadmap (by epic)</option>
          <option value="all">All tasks with dates</option>
        </select>
      </ProjectHeader>

      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={<GanttChartSquare size={40} />} title="Nothing to plot yet" hint="Create epics or set due dates on tasks to see them on the timeline." />
      ) : (
        <div className="card overflow-x-auto p-4">
          <div className="relative mb-2 h-5 min-w-[700px] border-b border-line text-[10px] text-muted">
            {months.map((m, i) => (
              <span key={i} className="absolute" style={{ left: `${m.left}%` }}>{m.label}</span>
            ))}
          </div>
          <div className="relative min-w-[700px] space-y-1.5">
            <div className="absolute bottom-0 top-0 w-px bg-red-400/70" style={{ left: `${todayLeft}%` }} title="Today" />
            {rows.map(({ task: t, children }) => (
              <div key={t._id}>
                <div className="group relative h-8">
                  <div className="absolute inset-y-1 rounded-md opacity-90 transition group-hover:opacity-100 cursor-pointer flex items-center gap-1 px-2 overflow-hidden"
                    style={{ ...barFor(t), background: `${resolveTaskType(t.type, project?.taskTypes).color}55`, border: `1px solid ${resolveTaskType(t.type, project?.taskTypes).color}` }}
                    onClick={() => setOpenTask(t._id)}
                    title={`${t.key} ${t.title}`}
                  >
                    <TypeIcon type={t.type} types={project?.taskTypes} size={10} />
                    <span className="truncate text-[11px] font-medium">{t.key} {t.title}</span>
                  </div>
                </div>
                {children.map((c) => (
                  <div key={c._id} className="group relative h-6 ml-0">
                    <div
                      className={cn("absolute inset-y-0.5 rounded cursor-pointer flex items-center px-1.5 overflow-hidden bg-line/70 hover:bg-line border border-line")}
                      style={barFor(c)}
                      onClick={() => setOpenTask(c._id)}
                      title={`${c.key} ${c.title}`}
                    >
                      <span className="truncate text-[10px]">{c.key} {c.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {openTask && <TaskModal taskId={openTask} project={project} onClose={() => setOpenTask(null)} onChanged={() => mutate()} />}
    </div>
  );
}
