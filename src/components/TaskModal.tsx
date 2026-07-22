"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Copy, Trash2, Archive, Plus, Link2, CornerDownRight,
} from "lucide-react";
import { fetcher, api } from "@/lib/client";
import { Modal, Avatar, TypeIcon, Spinner } from "@/components/ui";
import { PRIORITY_META, TYPE_META, TASK_TYPES, PRIORITIES } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-28 shrink-0 text-xs font-medium text-muted">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const selectCls =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-accent outline-none cursor-pointer";

export default function TaskModal({
  taskId,
  project,
  onClose,
  onChanged,
}: {
  taskId: string;
  project: Any; // populated project with statuses/labels/members
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { data, mutate, isLoading } = useSWR<Any>(`/api/tasks/${taskId}`, fetcher);
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const task = data?.task;
  const canEdit = data?.myRole && data.myRole !== "viewer";
  const members: Any[] = project?.members || [];
  const statuses: Any[] = project?.statuses || [];
  const labels: Any[] = project?.labels || [];

  const { data: sprintData } = useSWR<Any>(project?._id ? `/api/sprints?project=${project._id}` : null, fetcher);
  const { data: epicsData } = useSWR<Any>(project?._id ? `/api/tasks?project=${project._id}&type=epic&limit=50` : null, fetcher);

  async function patch(set: Any) {
    await api(`/api/tasks/${taskId}`, "PATCH", set);
    mutate();
    onChanged?.();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/comments`, "POST", { body: comment.trim() });
      setComment("");
      mutate();
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    await api("/api/tasks", "POST", {
      project: project._id,
      title: subtaskTitle.trim(),
      type: "subtask",
      parentTask: taskId,
      sprint: task?.sprint?._id || null,
    });
    setSubtaskTitle("");
    mutate();
    onChanged?.();
  }

  async function duplicate() {
    await api(`/api/tasks/${taskId}/duplicate`, "POST");
    onChanged?.();
    onClose();
  }

  async function remove() {
    if (!confirm(`Delete ${task.key} permanently? Subtasks and comments will also be deleted.`)) return;
    await api(`/api/tasks/${taskId}`, "DELETE");
    onChanged?.();
    onClose();
  }

  return (
    <Modal open onClose={onClose} wide title={
      task ? (
        <span className="flex items-center gap-2">
          <TypeIcon type={task.type} />
          <span className="font-mono text-xs text-muted">{task.key}</span>
          {task.epic && <span className="chip bg-purple-500/15 text-purple-500">{task.epic.key}</span>}
        </span>
      ) : "Task"
    }>
      {isLoading || !task ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
          {/* left column */}
          <div className="min-w-0">
            <input
              className="mb-3 w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-lg font-semibold outline-none hover:border-line focus:border-accent"
              defaultValue={task.title}
              disabled={!canEdit}
              onBlur={(e) => e.target.value !== task.title && e.target.value.trim() && patch({ title: e.target.value.trim() })}
            />

            {/* description */}
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold uppercase text-muted">Description</div>
              {editingDesc ? (
                <div>
                  <textarea className="input min-h-28 font-normal" value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus />
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary !py-1 text-xs" onClick={async () => { await patch({ description: desc }); setEditingDesc(false); }}>Save</button>
                    <button className="btn-ghost !py-1 text-xs" onClick={() => setEditingDesc(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn("min-h-10 whitespace-pre-wrap rounded-lg px-2 py-1.5 text-sm", canEdit && "cursor-text hover:bg-line/30")}
                  onClick={() => { if (canEdit) { setDesc(task.description || ""); setEditingDesc(true); } }}
                >
                  {task.description || <span className="text-muted">Add a description…</span>}
                </div>
              )}
            </div>

            {/* subtasks */}
            {task.type !== "subtask" && (
              <div className="mb-4">
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Subtasks ({data.subtasks.length})</div>
                <div className="space-y-1">
                  {data.subtasks.map((st: Any) => (
                    <div key={st._id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm">
                      <CornerDownRight size={13} className="text-muted" />
                      <span className="font-mono text-xs text-muted">{st.key}</span>
                      <span className={cn("truncate", statuses.find((s: Any) => s.id === st.status)?.category === "done" && "line-through text-muted")}>
                        {st.title}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <select
                          className="rounded border border-line bg-card px-1 py-0.5 text-xs"
                          value={st.status}
                          disabled={!canEdit}
                          onChange={async (e) => { await api(`/api/tasks/${st._id}`, "PATCH", { status: e.target.value }); mutate(); onChanged?.(); }}
                        >
                          {statuses.map((s: Any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <Avatar user={st.assignee} size={18} />
                      </span>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <form onSubmit={addSubtask} className="mt-1.5 flex gap-2">
                    <input className="input !py-1.5 text-sm" placeholder="Add a subtask…" value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
                    <button className="btn-ghost !py-1.5" disabled={!subtaskTitle.trim()}><Plus size={14} /></button>
                  </form>
                )}
              </div>
            )}

            {/* dependencies */}
            {task.dependencies?.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 text-xs font-semibold uppercase text-muted">Blocked by</div>
                {task.dependencies.map((d: Any) => (
                  <div key={d._id} className="flex items-center gap-2 text-sm py-0.5">
                    <Link2 size={13} className="text-red-400" />
                    <span className="font-mono text-xs text-muted">{d.key}</span>
                    <span className="truncate">{d.title}</span>
                    {canEdit && (
                      <button className="ml-auto text-xs text-muted hover:text-red-500"
                        onClick={() => patch({ dependencies: task.dependencies.filter((x: Any) => x._id !== d._id).map((x: Any) => x._id) })}>
                        remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* comments / activity */}
            <div className="border-t border-line pt-3">
              <div className="mb-2 flex gap-4 text-sm">
                <button className={cn("font-medium", tab === "comments" ? "text-accent" : "text-muted")} onClick={() => setTab("comments")}>
                  Comments ({data.comments.length})
                </button>
                <button className={cn("font-medium", tab === "activity" ? "text-accent" : "text-muted")} onClick={() => setTab("activity")}>
                  Activity
                </button>
              </div>
              {tab === "comments" ? (
                <div>
                  <div className="space-y-3">
                    {data.comments.map((c: Any) => (
                      <div key={c._id} className="flex gap-2.5">
                        <Avatar user={c.author} size={26} />
                        <div className="min-w-0">
                          <div className="text-xs">
                            <span className="font-medium">{c.author?.name}</span>{" "}
                            <span className="text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">{c.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <form onSubmit={addComment} className="mt-3">
                      <textarea
                        className="input min-h-16 text-sm"
                        placeholder="Write a comment… (@email to mention)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addComment(e); }}
                      />
                      <button className="btn-primary mt-2 !py-1.5 text-xs" disabled={busy || !comment.trim()}>Comment</button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {data.activity.map((a: Any) => (
                    <div key={a._id} className="flex items-start gap-2 text-xs">
                      <Avatar user={a.user} size={20} />
                      <div>
                        <span className="font-medium">{a.user?.name}</span>{" "}
                        <span className="text-muted">{a.detail}</span>
                        <div className="text-muted/70">{new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {data.activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
                </div>
              )}
            </div>
          </div>

          {/* right column: fields */}
          <div className="space-y-0.5 md:border-l md:border-line md:pl-4">
            <Field label="Status">
              <select className={selectCls} value={task.status} disabled={!canEdit} onChange={(e) => patch({ status: e.target.value })}>
                {statuses.map((s: Any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <select className={selectCls} value={task.assignee?._id || ""} disabled={!canEdit} onChange={(e) => patch({ assignee: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members.map((m: Any) => <option key={m.user._id} value={m.user._id}>{m.user.name}</option>)}
              </select>
            </Field>
            <Field label="Reporter">
              <span className="flex items-center gap-1.5 px-2 text-sm"><Avatar user={task.reporter} size={18} /> {task.reporter?.name}</span>
            </Field>
            <Field label="Type">
              <select className={selectCls} value={task.type} disabled={!canEdit} onChange={(e) => patch({ type: e.target.value })}>
                {TASK_TYPES.filter((t) => t !== "subtask" || task.type === "subtask").map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={selectCls} value={task.priority} disabled={!canEdit} onChange={(e) => patch({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </Field>
            <Field label="Sprint">
              <select className={selectCls} value={task.sprint?._id || ""} disabled={!canEdit} onChange={(e) => patch({ sprint: e.target.value || null })}>
                <option value="">Backlog</option>
                {(sprintData?.sprints || []).filter((s: Any) => s.status !== "completed").map((s: Any) => (
                  <option key={s._id} value={s._id}>{s.name}{s.status === "active" ? " (active)" : ""}</option>
                ))}
              </select>
            </Field>
            {task.type !== "epic" && (
              <Field label="Epic">
                <select className={selectCls} value={task.epic?._id || ""} disabled={!canEdit} onChange={(e) => patch({ epic: e.target.value || null })}>
                  <option value="">None</option>
                  {(epicsData?.tasks || []).map((ep: Any) => <option key={ep._id} value={ep._id}>{ep.key} {ep.title}</option>)}
                </select>
              </Field>
            )}
            <Field label="Story points">
              <input
                type="number" min={0} max={100}
                className="w-20 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-accent outline-none"
                defaultValue={task.storyPoints ?? ""}
                disabled={!canEdit}
                onBlur={(e) => patch({ storyPoints: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                className={cn("rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-accent outline-none",
                  isOverdue(task.dueDate) && "text-red-500")}
                defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                disabled={!canEdit}
                onChange={(e) => patch({ dueDate: e.target.value || null })}
              />
            </Field>
            <Field label="Labels">
              <div className="flex flex-wrap gap-1 px-2">
                {labels.map((l: Any) => {
                  const active = task.labels?.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      disabled={!canEdit}
                      className="chip cursor-pointer disabled:cursor-default"
                      style={{ background: active ? `${l.color}30` : "transparent", color: active ? l.color : "var(--muted)", border: `1px solid ${active ? l.color : "var(--border)"}` }}
                      onClick={() => patch({ labels: active ? task.labels.filter((x: string) => x !== l.id) : [...(task.labels || []), l.id] })}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Watchers">
              <span className="flex items-center gap-1 px-2">
                {task.watchers?.slice(0, 5).map((w: Any) => <Avatar key={w._id} user={w} size={20} />)}
                <span className="text-xs text-muted">{task.watchers?.length || 0}</span>
              </span>
            </Field>

            <div className="pt-3 text-xs text-muted px-2">
              Created {formatDate(task.createdAt)}
              {task.completedAt && <> · Completed {formatDate(task.completedAt)}</>}
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-1.5 pt-3">
                <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={duplicate} title="Duplicate"><Copy size={13} /> Duplicate</button>
                <button className="btn-ghost !px-2 !py-1.5 text-xs" onClick={() => patch({ archived: !task.archived })} title={task.archived ? "Unarchive" : "Archive"}>
                  <Archive size={13} /> {task.archived ? "Unarchive" : "Archive"}
                </button>
                {(data.myRole === "team_lead" || data.myRole === "project_admin") && (
                  <button className="btn-ghost !px-2 !py-1.5 text-xs text-red-500" onClick={remove}><Trash2 size={13} /> Delete</button>
                )}
              </div>
            )}
            {task.parentTask && (
              <div className="pt-2 text-xs text-muted px-2">
                Parent: <Link href="#" className="text-accent">{task.parentTask.key}</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
