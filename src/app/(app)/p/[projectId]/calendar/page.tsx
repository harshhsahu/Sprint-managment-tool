"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetcher } from "@/lib/client";
import { Spinner, TypeIcon } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import { useProject, FilterBar, ProjectHeader, emptyFilters, filtersToQuery, type TaskFilters, type Any } from "@/components/project/common";
import { PRIORITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function CalendarPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [openTask, setOpenTask] = useState<string | null>(null);

  const monthStart = month;
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const url = `/api/tasks?project=${projectId}&limit=200&dueAfter=${monthStart.toISOString()}&dueBefore=${new Date(monthEnd.getTime() + 86400000).toISOString()}${filtersToQuery(filters)}`;
  const { data, mutate, isLoading } = useSWR<Any>(url, fetcher, { keepPreviousData: true });
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);

  const weeks = useMemo(() => {
    const firstDay = new Date(monthStart);
    firstDay.setDate(1 - ((firstDay.getDay() + 6) % 7)); // start on Monday
    const days: Date[] = [];
    const d = new Date(firstDay);
    while (d <= monthEnd || days.length % 7 !== 0) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    const ws: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) ws.push(days.slice(i, i + 7));
    return ws;
  }, [monthStart, monthEnd]);

  const tasksOn = (day: Date) =>
    tasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === day.toDateString());

  const today = new Date().toDateString();

  if (!project) return <Spinner label="Loading calendar…" />;

  return (
    <div className="p-5">
      <ProjectHeader project={project} title="Calendar">
        <div className="flex items-center gap-1">
          <button className="btn-ghost !p-1.5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
          <span className="w-36 text-center text-sm font-semibold">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button className="btn-ghost !p-1.5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
        </div>
      </ProjectHeader>

      <div className="mb-3"><FilterBar project={project} filters={filters} setFilters={setFilters} /></div>

      {isLoading && !data ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold uppercase text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-0">
              {week.map((day) => {
                const inMonth = day.getMonth() === month.getMonth();
                const dayTasks = tasksOn(day);
                return (
                  <div key={day.toISOString()} className={cn("min-h-24 border-r border-line p-1.5 last:border-r-0", !inMonth && "bg-background/60 opacity-50")}>
                    <div className={cn("mb-1 text-xs", day.toDateString() === today ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent font-bold text-white" : "text-muted")}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((t) => (
                        <button
                          key={t._id}
                          onClick={() => setOpenTask(t._id)}
                          className="flex w-full items-center gap-1 rounded border border-line bg-card px-1 py-0.5 text-left text-[11px] hover:border-accent"
                          style={{ borderLeftColor: PRIORITY_META[t.priority as keyof typeof PRIORITY_META]?.color, borderLeftWidth: 2 }}
                          title={`${t.key} ${t.title}`}
                        >
                          <TypeIcon type={t.type} size={10} />
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                      {dayTasks.length > 3 && <div className="text-[10px] text-muted">+{dayTasks.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {openTask && <TaskModal taskId={openTask} project={project} onClose={() => setOpenTask(null)} onChanged={() => mutate()} />}
    </div>
  );
}
