"use client";

import { use, useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, AlertTriangle } from "lucide-react";
import { fetcher, api } from "@/lib/client";
import { Spinner } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import {
  useProject, FilterBar, TaskCard, BulkBar, ProjectHeader, emptyFilters,
  filtersToQuery, useGroups, type TaskFilters, type Any,
} from "@/components/project/common";
import { cn } from "@/lib/utils";

function QuickCreate({ projectId, status, sprintId, onCreated }: { projectId: string; status: string; sprintId?: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Create the task and keep the box open (cleared + focused) so you can rapidly add more.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await api("/api/tasks", "POST", { project: projectId, title: value, status, sprint: sprintId || null });
      setTitle("");
      onCreated();
      ref.current?.focus(); // stay in "add mode" for the next task
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return (
      <button className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-line/40 hover:text-foreground" onClick={() => setOpen(true)}>
        <Plus size={13} /> Add task
      </button>
    );
  }
  return (
    <form onSubmit={submit}>
      <textarea
        ref={ref}
        className="input !py-1.5 text-sm"
        placeholder="What needs to be done? Enter to add, Esc to close"
        value={title}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); if (e.key === "Escape") setOpen(false); }}
        onBlur={() => !title.trim() && setOpen(false)}
      />
    </form>
  );
}

export default function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project } = useProject(projectId);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [swimlane, setSwimlane] = useState("none");
  const [selected, setSelected] = useState<string[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [sprintScope, setSprintScope] = useState("active"); // active sprint | all tasks

  // open task from ?task= deep link
  useEffect(() => {
    const t = searchParams.get("task");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setOpenTask(t);
  }, [searchParams]);

  const { data: sprintData } = useSWR<Any>(`/api/sprints?project=${projectId}`, fetcher);
  const activeSprint = (sprintData?.sprints || []).find((s: Any) => s.status === "active");
  const sprintFilter = sprintScope === "active" && activeSprint ? `&sprint=${activeSprint._id}` : "";

  const tasksUrl = `/api/tasks?project=${projectId}&sort=order&limit=200${sprintFilter}${filtersToQuery(filters)}`;
  const { data, mutate, isLoading } = useSWR<Any>(tasksUrl, fetcher, { keepPreviousData: true });
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);
  const statuses: Any[] = project?.statuses || [];
  const lanes = useGroups(tasks, swimlane, project);

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const [, destStatus] = destination.droppableId.split("::");
    const [, srcStatus] = source.droppableId.split("::");
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // compute new order between neighbors within destination column (same lane)
    const [destLaneKey] = destination.droppableId.split("::");
    const lane = lanes.find((l) => l.key === destLaneKey);
    const colTasks = (lane?.tasks || []).filter((t) => t.status === destStatus && t._id !== draggableId);
    const before = colTasks[destination.index - 1];
    const after = colTasks[destination.index];
    let newOrder: number;
    if (!before && !after) newOrder = 1000;
    else if (!before) newOrder = after.order - 1;
    else if (!after) newOrder = before.order + 1;
    else newOrder = (before.order + after.order) / 2;

    // optimistic update
    mutate(
      { ...data, tasks: tasks.map((t) => (t._id === draggableId ? { ...t, status: destStatus, order: newOrder } : t)) },
      { revalidate: false }
    );
    await api("/api/tasks/reorder", "POST", {
      project: projectId,
      updates: [{ id: draggableId, order: newOrder, status: destStatus !== srcStatus ? destStatus : undefined }],
    });
    // status change also needs the full PATCH for notifications/timestamps
    if (destStatus !== srcStatus) {
      await api(`/api/tasks/${draggableId}`, "PATCH", { status: destStatus });
    }
    mutate();
  }

  const toggleSelect = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  if (!project) return <Spinner label="Loading board…" />;

  return (
    <div className="flex h-full flex-col p-5">
      <ProjectHeader project={project} title="Board">
        <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs" value={sprintScope} onChange={(e) => setSprintScope(e.target.value)}>
          <option value="active">{activeSprint ? `Sprint: ${activeSprint.name}` : "Active sprint (none)"}</option>
          <option value="all">All tasks</option>
        </select>
        <select className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs" value={swimlane} onChange={(e) => setSwimlane(e.target.value)}>
          <option value="none">No swimlanes</option>
          <option value="assignee">Swimlane: Assignee</option>
          <option value="priority">Swimlane: Priority</option>
          <option value="epic">Swimlane: Epic</option>
        </select>
      </ProjectHeader>

      <div className="mb-3">
        <FilterBar project={project} filters={filters} setFilters={setFilters} />
      </div>

      {isLoading && !data ? (
        <Spinner />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="min-h-0 flex-1 space-y-6 overflow-auto pb-4">
            {lanes.map((lane) => (
              <div key={lane.key}>
                {swimlane !== "none" && (
                  <div className="mb-2 text-sm font-semibold text-muted">{lane.label} <span className="font-normal">({lane.tasks.length})</span></div>
                )}
                <div className="flex gap-3">
                  {statuses.map((st) => {
                    const colTasks = lane.tasks
                      .filter((t) => t.status === st.id)
                      .sort((a, b) => a.order - b.order);
                    const wipExceeded = st.wipLimit > 0 && colTasks.length > st.wipLimit;
                    return (
                      <Droppable droppableId={`${lane.key}::${st.id}`} key={st.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex w-72 shrink-0 flex-col rounded-xl border bg-background/60 p-2",
                              snapshot.isDraggingOver ? "border-accent" : "border-line",
                              wipExceeded && "border-red-400"
                            )}
                          >
                            <div className="mb-2 flex items-center gap-2 px-1">
                              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />
                              <span className="text-xs font-semibold uppercase tracking-wide">{st.name}</span>
                              <span className="text-xs text-muted">{colTasks.length}{st.wipLimit > 0 && `/${st.wipLimit}`}</span>
                              {wipExceeded && (
                                <span title={`WIP limit of ${st.wipLimit} exceeded`}>
                                  <AlertTriangle size={13} className="text-red-500" />
                                </span>
                              )}
                            </div>
                            <div className="min-h-8 flex-1 space-y-2">
                              {colTasks.map((t, i) => (
                                <Draggable draggableId={t._id} index={i} key={t._id}>
                                  {(dp, ds) => (
                                    <div
                                      ref={dp.innerRef}
                                      {...dp.draggableProps}
                                      {...dp.dragHandleProps}
                                      className={cn(ds.isDragging && "rotate-2 opacity-90")}
                                    >
                                      <TaskCard
                                        task={t}
                                        onClick={() => setOpenTask(t._id)}
                                        selected={selected.includes(t._id)}
                                        onToggleSelect={() => toggleSelect(t._id)}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                            <QuickCreate
                              projectId={projectId}
                              status={st.id}
                              sprintId={sprintScope === "active" ? activeSprint?._id : null}
                              onCreated={() => mutate()}
                            />
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      <BulkBar project={project} selected={selected} clear={() => setSelected([])} onDone={() => mutate()} />

      {openTask && (
        <TaskModal
          taskId={openTask}
          project={project}
          onClose={() => {
            setOpenTask(null);
            if (searchParams.get("task")) router.replace(`/p/${projectId}/board`);
          }}
          onChanged={() => mutate()}
        />
      )}
    </div>
  );
}
