"use client";

import { use, useMemo, useState } from "react";
import useSWR from "swr";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, Play, CheckCircle2, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { fetcher, api } from "@/lib/client";
import { Spinner, Modal, Avatar, TypeIcon, PriorityBadge } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import {
  useProject, FilterBar, BulkBar, ProjectHeader, emptyFilters, filtersToQuery,
  type TaskFilters, type Any,
} from "@/components/project/common";
import { cn, formatDate } from "@/lib/utils";

function SprintForm({ projectId, sprint, onClose, onSaved }: { projectId: string; sprint?: Any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: sprint?.name || "",
    goal: sprint?.goal || "",
    startDate: sprint?.startDate ? sprint.startDate.slice(0, 10) : "",
    endDate: sprint?.endDate ? sprint.endDate.slice(0, 10) : "",
    capacity: sprint?.capacity || 0,
  });
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (sprint) {
        await api(`/api/sprints/${sprint._id}`, "PATCH", { ...form, capacity: Number(form.capacity) });
      } else {
        await api("/api/sprints", "POST", { project: projectId, ...form, capacity: Number(form.capacity) });
      }
      onSaved(); onClose();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <Modal open onClose={onClose} title={sprint ? `Edit ${sprint.name}` : "Create sprint"}>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" placeholder="Sprint name (e.g. Sprint 12)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        <textarea className="input" placeholder="Sprint goal (optional)" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Start date</label>
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">End date</label>
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Team capacity (story points)</label>
          <input className="input" type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full">{sprint ? "Save changes" : "Create sprint"}</button>
      </form>
    </Modal>
  );
}

function Row({ task, onClick, selected, toggle, statuses }: { task: Any; onClick: () => void; selected: boolean; toggle: () => void; statuses: Any[] }) {
  const st = statuses.find((s: Any) => s.id === task.status);
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 border-b border-line bg-card px-3 py-2 text-sm hover:bg-line/30",
        selected && "bg-accent/10"
      )}
    >
      <input type="checkbox" checked={selected} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggle(); }} />
      <TypeIcon type={task.type} size={12} />
      <span className="font-mono text-xs text-muted shrink-0">{task.key}</span>
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {st && <span className="chip !text-[10px] shrink-0" style={{ background: `${st.color}22`, color: st.color }}>{st.name}</span>}
      <PriorityBadge priority={task.priority} compact />
      <span className="chip bg-line/60 text-muted !text-[10px] w-10 justify-center">{task.storyPoints ?? "–"}</span>
      <Avatar user={task.assignee} size={20} />
    </div>
  );
}

export default function BacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [sprintModal, setSprintModal] = useState<{ sprint?: Any } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [completeSprint, setCompleteSprint] = useState<Any>(null);
  const [moveTo, setMoveTo] = useState("");

  const { data: sprintData, mutate: mutSprints } = useSWR<Any>(`/api/sprints?project=${projectId}`, fetcher);
  const tasksUrl = `/api/tasks?project=${projectId}&sort=order&limit=200${filtersToQuery(filters)}`;
  const { data, mutate, isLoading } = useSWR<Any>(tasksUrl, fetcher, { keepPreviousData: true });

  const sprints: Any[] = (sprintData?.sprints || []).filter((s: Any) => s.status === "active" || s.status === "planned");
  const tasks: Any[] = useMemo(() => data?.tasks || [], [data]);
  const statuses: Any[] = project?.statuses || [];
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);

  const sections = useMemo(() => {
    const bySprint = new Map<string, Any[]>();
    for (const s of sprints) bySprint.set(s._id, []);
    const backlog: Any[] = [];
    for (const t of tasks) {
      const sid = t.sprint?._id || t.sprint;
      if (sid && bySprint.has(String(sid))) bySprint.get(String(sid))!.push(t);
      else if (!sid) backlog.push(t);
    }
    const sort = (a: Any, b: Any) => a.order - b.order;
    return [
      ...sprints.map((s) => ({ id: String(s._id), sprint: s, tasks: (bySprint.get(s._id) || []).sort(sort) })),
      { id: "backlog", sprint: null as Any, tasks: backlog.sort(sort) },
    ];
  }, [sprints, tasks]);

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const destSection = sections.find((s) => s.id === destination.droppableId);
    if (!destSection) return;
    const destTasks = destSection.tasks.filter((t) => t._id !== draggableId);
    const before = destTasks[destination.index - 1];
    const after = destTasks[destination.index];
    let newOrder: number;
    if (!before && !after) newOrder = 1000;
    else if (!before) newOrder = after.order - 1;
    else if (!after) newOrder = before.order + 1;
    else newOrder = (before.order + after.order) / 2;

    const newSprint = destination.droppableId === "backlog" ? null : destination.droppableId;
    mutate(
      { ...data, tasks: tasks.map((t) => (t._id === draggableId ? { ...t, sprint: newSprint ? { _id: newSprint } : null, order: newOrder } : t)) },
      { revalidate: false }
    );
    await api("/api/tasks/reorder", "POST", {
      project: projectId,
      updates: [{ id: draggableId, order: newOrder, sprint: newSprint }],
    });
    mutate();
  }

  async function sprintAction(sprint: Any, action: "start" | "archive") {
    try {
      await api(`/api/sprints/${sprint._id}`, "PATCH", { action });
      mutSprints(); mutate();
    } catch (e) { alert((e as Error).message); }
  }

  async function doCompleteSprint() {
    await api(`/api/sprints/${completeSprint._id}`, "PATCH", { action: "complete", moveIncompleteTo: moveTo || null });
    setCompleteSprint(null); setMoveTo("");
    mutSprints(); mutate();
  }

  async function deleteSprint(sprint: Any) {
    if (!confirm(`Delete sprint "${sprint.name}"? Its tasks move back to the backlog.`)) return;
    await api(`/api/sprints/${sprint._id}`, "DELETE");
    mutSprints(); mutate();
  }

  const toggleSelect = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  if (!project) return <Spinner label="Loading backlog…" />;

  return (
    <div className="mx-auto max-w-5xl p-5">
      <ProjectHeader project={project} title="Backlog & Sprints">
        <button className="btn-primary !py-1.5 text-xs" onClick={() => setSprintModal({})}><Plus size={13} /> New sprint</button>
      </ProjectHeader>

      <div className="mb-4">
        <FilterBar project={project} filters={filters} setFilters={setFilters} />
      </div>

      {isLoading && !data ? (
        <Spinner />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-5 pb-16">
            {sections.map((section) => {
              const pts = section.tasks.reduce((a, t) => a + (t.storyPoints || 0), 0);
              const donePts = section.tasks.filter((t) => doneIds.includes(t.status)).reduce((a, t) => a + (t.storyPoints || 0), 0);
              const s = section.sprint;
              const isCollapsed = collapsed[section.id];
              return (
                <div key={section.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line bg-background/50 px-3 py-2.5">
                    <button onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))} className="text-muted">
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <span className="font-semibold text-sm">
                      {s ? s.name : "Backlog"}
                      {s?.status === "active" && <span className="chip ml-2 bg-green-500/15 text-green-500">Active</span>}
                    </span>
                    {s?.goal && <span className="hidden text-xs text-muted sm:inline">— {s.goal}</span>}
                    {s?.startDate && (
                      <span className="text-xs text-muted">{formatDate(s.startDate)} → {formatDate(s.endDate)}</span>
                    )}
                    <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                      <span>{section.tasks.length} issues</span>
                      <span className="chip bg-line/60">{donePts}/{pts} pts{s?.capacity ? ` · cap ${s.capacity}` : ""}</span>
                      {s && s.capacity > 0 && pts > s.capacity && (
                        <span className="chip bg-red-500/15 text-red-500">Over capacity</span>
                      )}
                    </span>
                    {s && (
                      <span className="flex items-center gap-1">
                        {s.status === "planned" && (
                          <button className="btn-primary !px-2 !py-1 text-xs" onClick={() => sprintAction(s, "start")}><Play size={12} /> Start</button>
                        )}
                        {s.status === "active" && (
                          <button className="btn-ghost !px-2 !py-1 text-xs text-green-500" onClick={() => setCompleteSprint(s)}>
                            <CheckCircle2 size={12} /> Complete
                          </button>
                        )}
                        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setSprintModal({ sprint: s })}><Pencil size={12} /></button>
                        <button className="btn-ghost !px-2 !py-1 text-xs text-red-500" onClick={() => deleteSprint(s)}><Trash2 size={12} /></button>
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <Droppable droppableId={section.id}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className={cn("min-h-10", snapshot.isDraggingOver && "bg-accent/5")}>
                          {section.tasks.map((t, i) => (
                            <Draggable draggableId={t._id} index={i} key={t._id}>
                              {(dp, ds) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} className={cn(ds.isDragging && "opacity-90 shadow-lg")}>
                                  <Row task={t} onClick={() => setOpenTask(t._id)} selected={selected.includes(t._id)} toggle={() => toggleSelect(t._id)} statuses={statuses} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {section.tasks.length === 0 && (
                            <p className="px-4 py-3 text-xs text-muted">
                              {s ? "Drag tasks here to plan this sprint." : "Backlog is empty."}
                            </p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <BulkBar project={project} selected={selected} clear={() => setSelected([])} onDone={() => { mutate(); mutSprints(); }} />

      {sprintModal && (
        <SprintForm projectId={projectId} sprint={sprintModal.sprint} onClose={() => setSprintModal(null)} onSaved={() => { mutSprints(); mutate(); }} />
      )}

      {completeSprint && (
        <Modal open onClose={() => setCompleteSprint(null)} title={`Complete ${completeSprint.name}`}>
          <p className="mb-3 text-sm text-muted">Incomplete tasks will be moved to:</p>
          <select className="input mb-4" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Backlog</option>
            {sprints.filter((s: Any) => s._id !== completeSprint._id && s.status === "planned").map((s: Any) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <button className="btn-primary w-full" onClick={doCompleteSprint}>Complete sprint</button>
        </Modal>
      )}

      {openTask && (
        <TaskModal taskId={openTask} project={project} onClose={() => setOpenTask(null)} onChanged={() => { mutate(); mutSprints(); }} />
      )}
    </div>
  );
}
