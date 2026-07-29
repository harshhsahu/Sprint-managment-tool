"use client";

import { useRef, useState } from "react";
import {
  Copy, Trash2, Archive, Plus, Link2, CornerDownRight, CornerUpLeft, ArrowLeft,
} from "lucide-react";
import { api, errMsg } from "@/store/api";
import {
  useQ, useAppDispatch, useUpdateTaskMutation, useCreateTaskMutation,
  useAddCommentMutation, useDuplicateTaskMutation, useDeleteTaskMutation,
  useCreateFieldOptionMutation,
} from "@/store/hooks";
import { Modal, Avatar, TypeIcon, Spinner, Button } from "@/components/ui";
import { PRIORITY_META, TYPE_META, TASK_TYPES, PRIORITIES, REQUIRABLE_TASK_FIELDS } from "@/lib/constants";
import { cn, formatDate, isOverdue, projectAssignees } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** Is a soft-required field still unfilled on this task? Used only to nudge — never to block. */
function isFieldEmpty(task: Any, id: string): boolean {
  switch (id) {
    case "assignee": return !task.assignee;
    case "description": return !(task.description && task.description.trim());
    case "priority": return !task.priority;
    case "dueDate": return !task.dueDate;
    case "storyPoints": return task.storyPoints == null;
    case "epic": return !task.epic;
    case "sprint": return !task.sprint;
    default: return false;
  }
}

const MENTION_TOKEN = /@\[([^\]]+)\]\([a-f0-9]{24}\)/g;

/** Render a comment body, replacing `@[Name](userId)` tokens with a highlighted @Name. */
function renderCommentBody(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_TOKEN.lastIndex = 0;
  let k = 0;
  while ((m = MENTION_TOKEN.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span key={k++} className="rounded bg-accent/15 px-1 font-medium text-accent">
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

/** Serialize a comment-composer contenteditable element back to the plain-text
    `@[Name](userId)` format the API expects. Mention chips carry the id/name in
    data-* attributes; everything else is its text, with block elements as newlines. */
function serializeEditor(el: HTMLElement | null): string {
  if (!el) return "";
  let out = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent || "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const c = child as HTMLElement;
        if (c.dataset.mentionId) {
          out += `@[${c.dataset.mentionName}](${c.dataset.mentionId})`;
        } else if (c.tagName === "BR") {
          out += "\n";
        } else {
          if (c.tagName === "DIV" || c.tagName === "P") out += "\n";
          walk(c);
        }
      }
    });
  };
  walk(el);
  return out.replace(/ /g, " "); // normalize the nbsp we insert after chips
}

/** Comment box with @mention chips. A contentEditable surface renders each picked
    member as a non-editable pill (so you never see the raw `@[Name](id)` token);
    on submit it serializes back to that token for the backend to resolve. */
function CommentComposer({
  members,
  busy,
  onSubmit,
}: {
  members: Any[];
  busy: boolean;
  onSubmit: (body: string) => Promise<void>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<{ query: string } | null>(null);
  const [sel, setSel] = useState(0);
  const [empty, setEmpty] = useState(true);

  const matches: Any[] = mention
    ? members
        .filter(({ user }) => {
          const q = mention.query.toLowerCase();
          return user?.name?.toLowerCase().includes(q) || user?.email?.toLowerCase().includes(q);
        })
        .slice(0, 6)
    : [];
  const selIdx = matches.length ? Math.min(sel, matches.length - 1) : 0;

  function refreshEmpty() {
    setEmpty(!(editorRef.current?.textContent || "").trim());
  }

  // Detect an in-progress "@query" immediately before a collapsed caret.
  function detectMention() {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !s.isCollapsed) return setMention(null);
    const node = s.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !editorRef.current?.contains(node)) return setMention(null);
    const before = (node.textContent || "").slice(0, s.anchorOffset);
    const m = before.match(/(?:^|\s)@([\w.+-]*)$/);
    if (m) {
      setMention({ query: m[1] });
      setSel(0);
    } else {
      setMention(null);
    }
  }

  // Replace the "@query" before the caret with a non-editable mention chip.
  function insertMention(u: Any) {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !editorRef.current) return;
    const node = s.getRangeAt(0).startContainer;
    const offset = s.getRangeAt(0).startOffset;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent || "";
    const m = text.slice(0, offset).match(/(?:^|\s)@([\w.+-]*)$/);
    if (!m) return;
    const at = offset - m[1].length - 1; // index of the "@"

    const parent = node.parentNode as Node;
    const beforeNode = document.createTextNode(text.slice(0, at));
    const chip = document.createElement("span");
    chip.dataset.mentionId = String(u._id);
    chip.dataset.mentionName = u.name;
    chip.contentEditable = "false";
    chip.className = "rounded bg-accent/15 px-1 font-medium text-accent";
    chip.textContent = `@${u.name}`;
    const afterNode = document.createTextNode(" " + text.slice(offset)); // nbsp so the caret lands after the chip

    parent.replaceChild(afterNode, node);
    parent.insertBefore(chip, afterNode);
    parent.insertBefore(beforeNode, chip);

    const r = document.createRange();
    r.setStart(afterNode, 1);
    r.collapse(true);
    s.removeAllRanges();
    s.addRange(r);

    setMention(null);
    editorRef.current.focus();
    refreshEmpty();
  }

  async function submit() {
    const body = serializeEditor(editorRef.current).trim();
    if (!body || busy) return;
    try {
      await onSubmit(body);
      if (editorRef.current) editorRef.current.innerHTML = "";
      setMention(null);
      refreshEmpty();
    } catch (err) {
      alert(errMsg(err));
    }
  }

  return (
    <div className="mt-3">
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          data-placeholder="Write a comment… (type @ to mention)"
          className="comment-editor input min-h-16 whitespace-pre-wrap break-words text-sm"
          onInput={() => { refreshEmpty(); detectMention(); }}
          onKeyUp={detectMention}
          onMouseUp={detectMention}
          onKeyDown={(e) => {
            if (mention && matches.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => (i + 1) % matches.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => (i - 1 + matches.length) % matches.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(matches[selIdx].user); return; }
              if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
          }}
        />
        {mention && matches.length > 0 && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMention(null)} />
            <div className="absolute bottom-full z-40 mb-1 max-h-56 w-64 overflow-y-auto card p-1 shadow-xl">
              {matches.map((mm: Any, i: number) => (
                <button
                  type="button"
                  key={mm.user._id}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(mm.user); }}
                  onMouseEnter={() => setSel(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                    i === selIdx ? "bg-accent/15" : "hover:bg-line/60"
                  )}
                >
                  <Avatar user={mm.user} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{mm.user.name}</span>
                    <span className="block truncate text-xs text-muted">{mm.user.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <Button type="button" pending={busy} className="mt-2 !py-1.5 text-xs" disabled={empty} onClick={submit}>
        Comment
      </Button>
    </div>
  );
}

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
  project: Any; // populated project with statuses/customFields/members
  onClose: () => void;
  onChanged?: () => void;
}) {
  // TaskModal can navigate between related tasks (open a subtask, jump to the
  // parent) without unmounting. `currentId` is the task on screen; `navStack`
  // remembers where we came from so the Back button can return.
  const [currentId, setCurrentId] = useState(taskId);
  const [navStack, setNavStack] = useState<string[]>([]);
  // When the parent opens a different task, reset navigation (adjust state
  // during render — the React-recommended alternative to a reset effect).
  const [prevTaskId, setPrevTaskId] = useState(taskId);
  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setCurrentId(taskId);
    setNavStack([]);
  }

  const dispatch = useAppDispatch();
  const [updateTask] = useUpdateTaskMutation();
  const [createTaskM] = useCreateTaskMutation();
  const [addCommentM] = useAddCommentMutation();
  const [duplicateTaskM] = useDuplicateTaskMutation();
  const [deleteTaskM] = useDeleteTaskMutation();
  const [createFieldOptionM] = useCreateFieldOptionMutation();

  const { data, mutate, isLoading } = useQ.useTask(currentId);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  // Local copy of the project's custom fields so options added inline show up
  // immediately, without waiting for the parent project to refetch. Kept in sync
  // with the project config below — otherwise a field/option added in Settings
  // wouldn't appear here until a full page refresh.
  const [customFieldsState, setCustomFieldsState] = useState<Any[]>(project?.customFields || []);
  const [prevProjectCF, setPrevProjectCF] = useState(project?.customFields);
  if (project?.customFields !== prevProjectCF) {
    setPrevProjectCF(project?.customFields);
    setCustomFieldsState(project?.customFields || []);
  }
  const [addingOptFor, setAddingOptFor] = useState<string | null>(null);
  const [newOpt, setNewOpt] = useState("");

  const task = data?.task;
  const caps: string[] = data?.myCapabilities || [];
  const has = (c: string) => caps.includes(c);
  const canEdit = has("task:edit");
  const canComment = has("task:comment");
  const members: Any[] = projectAssignees(project);
  const statuses: Any[] = project?.statuses || [];
  const hiddenFields: string[] = project?.hiddenFields || [];
  const showField = (id: string) => !hiddenFields.includes(id);
  const requiredFields: string[] = project?.requiredFields || [];
  const missingRequired = task
    ? REQUIRABLE_TASK_FIELDS.filter((f) => requiredFields.includes(f.id) && isFieldEmpty(task, f.id)).map((f) => f.label)
    : [];

  async function createOption(e: React.FormEvent, fieldId: string) {
    e.preventDefault();
    const name = newOpt.trim();
    if (!name) return;
    try {
      const res = await createFieldOptionM({ projectId: project._id, fieldId, name }).unwrap();
      setCustomFieldsState(res.customFields);
      setNewOpt("");
      setAddingOptFor(null);
      const cur: string[] = task.customFields?.[fieldId] || [];
      await patch({ customFields: { [fieldId]: [...cur, res.option.id] } });
      // Refresh the shared project cache so the new option shows up everywhere
      // (board/list filters, other open views) without a manual refresh.
      dispatch(api.util.invalidateTags([{ type: "Project", id: project._id }]));
    } catch (err) {
      alert(errMsg(err));
    }
  }

  const { data: sprintData } = useQ.useSprints(project?._id ? `/api/sprints?project=${project._id}` : null);
  const { data: epicsData } = useQ.useTasks(project?._id ? `/api/tasks?project=${project._id}&type=epic&limit=50` : null);

  // Open a related task (subtask/parent) inside this same modal.
  function navigate(id?: string) {
    if (!id || id === currentId) return;
    setNavStack((s) => [...s, currentId]);
    setCurrentId(id);
    setSubtaskTitle("");
    setEditingDesc(false);
  }
  function goBack() {
    setNavStack((s) => {
      if (!s.length) return s;
      setCurrentId(s[s.length - 1]);
      return s.slice(0, -1);
    });
    setEditingDesc(false);
  }

  // Optimistic via the updateTask endpoint — the field updates on screen instantly.
  async function patch(set: Any) {
    await updateTask({ id: currentId, set }).unwrap();
    onChanged?.();
  }

  async function addComment(body: string) {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await addCommentM({ id: currentId, body: text }).unwrap();
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    await createTaskM({
      project: project._id,
      title: subtaskTitle.trim(),
      type: "subtask",
      parentTask: currentId,
      sprint: task?.sprint?._id || null,
    }).unwrap();
    setSubtaskTitle("");
    mutate();
    onChanged?.();
  }

  async function duplicate() {
    await duplicateTaskM(currentId).unwrap();
    onChanged?.();
    onClose();
  }

  async function remove() {
    if (!confirm(`Delete ${task.key} permanently? Subtasks and comments will also be deleted.`)) return;
    await deleteTaskM(currentId).unwrap();
    onChanged?.();
    // If we drilled in from another task, return to it instead of closing.
    if (navStack.length) goBack();
    else onClose();
  }

  return (
    <Modal open onClose={onClose} wide title={
      task ? (
        <span className="flex items-center gap-2">
          {navStack.length > 0 && (
            <button onClick={goBack} className="btn-ghost !px-1.5 !py-1 -ml-1.5" title="Back">
              <ArrowLeft size={14} />
            </button>
          )}
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

            {/* parent task — click to open the parent from a subtask */}
            {task.parentTask && (
              <button
                onClick={() => navigate(task.parentTask._id)}
                className="mb-3 flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left text-sm transition hover:border-accent"
                title={`Open parent ${task.parentTask.key}`}
              >
                <CornerUpLeft size={13} className="text-muted" />
                <span className="text-xs font-medium text-muted">Parent</span>
                <TypeIcon type={task.parentTask.type} size={12} />
                <span className="font-mono text-xs text-muted">{task.parentTask.key}</span>
                <span className="truncate">{task.parentTask.title}</span>
              </button>
            )}

            {/* soft-required nudge — informational only, never blocks saving */}
            {missingRequired.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Please fill in: <b>{missingRequired.join(", ")}</b>. You can still save without them.
              </div>
            )}

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
                    <div key={st._id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm transition hover:border-accent">
                      <button
                        onClick={() => navigate(st._id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        title={`Open ${st.key}`}
                      >
                        <CornerDownRight size={13} className="text-muted" />
                        <span className="font-mono text-xs text-muted">{st.key}</span>
                        <span className={cn("truncate", statuses.find((s: Any) => s.id === st.status)?.category === "done" && "line-through text-muted")}>
                          {st.title}
                        </span>
                      </button>
                      <span className="flex items-center gap-1.5">
                        <select
                          className="rounded border border-line bg-card px-1 py-0.5 text-xs"
                          value={st.status}
                          disabled={!canEdit}
                          onChange={async (e) => { await updateTask({ id: st._id, set: { status: e.target.value } }).unwrap(); mutate(); onChanged?.(); }}
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
            {showField("dependencies") && task.dependencies?.length > 0 && (
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
                          <div className="whitespace-pre-wrap text-sm">{renderCommentBody(c.body)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {canComment ? (
                    <CommentComposer key={currentId} members={members} busy={busy} onSubmit={addComment} />
                  ) : (
                    <p className="mt-3 text-xs text-muted">You have view-only access here — commenting is disabled.</p>
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
            {showField("sprint") && (
            <Field label="Sprint">
              <select className={selectCls} value={task.sprint?._id || ""} disabled={!canEdit} onChange={(e) => patch({ sprint: e.target.value || null })}>
                <option value="">Backlog</option>
                {(sprintData?.sprints || []).filter((s: Any) => s.status !== "completed").map((s: Any) => (
                  <option key={s._id} value={s._id}>{s.name}{s.status === "active" ? " (active)" : ""}</option>
                ))}
              </select>
            </Field>
            )}
            {task.type !== "epic" && showField("epic") && (
              <Field label="Epic">
                <select className={selectCls} value={task.epic?._id || ""} disabled={!canEdit} onChange={(e) => patch({ epic: e.target.value || null })}>
                  <option value="">None</option>
                  {(epicsData?.tasks || []).map((ep: Any) => <option key={ep._id} value={ep._id}>{ep.key} {ep.title}</option>)}
                </select>
              </Field>
            )}
            {showField("storyPoints") && (
            <Field label="Story points">
              <input
                type="number" min={0} max={100}
                className="w-20 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-accent outline-none"
                defaultValue={task.storyPoints ?? ""}
                disabled={!canEdit}
                onBlur={(e) => patch({ storyPoints: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            )}
            {showField("dueDate") && (
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
            )}
            {customFieldsState.map((cf: Any) => {
              const inputCls = "rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-accent outline-none";
              if (cf.type === "multiselect") {
                const selected: string[] = task.customFields?.[cf.id] || [];
                return (
                  <Field key={cf.id} label={cf.name}>
                    <div className="flex flex-wrap items-center gap-1 px-2">
                      {(cf.options || []).map((o: Any) => {
                        const active = selected.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            disabled={!canEdit}
                            className="chip cursor-pointer disabled:cursor-default"
                            style={{ background: active ? `${o.color}30` : "transparent", color: active ? o.color : "var(--muted)", border: `1px solid ${active ? o.color : "var(--border)"}` }}
                            onClick={() => patch({ customFields: { [cf.id]: active ? selected.filter((x) => x !== o.id) : [...selected, o.id] } })}
                          >
                            {o.name}
                          </button>
                        );
                      })}
                      {canEdit && addingOptFor !== cf.id && (
                        <button className="chip cursor-pointer" style={{ border: "1px dashed var(--border)", color: "var(--muted)" }} onClick={() => { setAddingOptFor(cf.id); setNewOpt(""); }}>
                          <Plus size={11} /> Option
                        </button>
                      )}
                    </div>
                    {canEdit && addingOptFor === cf.id && (
                      <form onSubmit={(e) => createOption(e, cf.id)} className="mt-1.5 flex gap-1.5 px-2">
                        <input
                          className="input !py-1 text-xs"
                          placeholder="New option name"
                          value={newOpt}
                          autoFocus
                          onChange={(e) => setNewOpt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") { setAddingOptFor(null); setNewOpt(""); } }}
                        />
                        <button className="btn-primary !px-2 !py-1 text-xs" disabled={!newOpt.trim()}>Add</button>
                      </form>
                    )}
                  </Field>
                );
              }
              const val = task.customFields?.[cf.id] ?? "";
              return (
                <Field key={cf.id} label={cf.name}>
                  {cf.type === "date" ? (
                    <input type="date" className={inputCls} defaultValue={val ? String(val).slice(0, 10) : ""} disabled={!canEdit}
                      onChange={(e) => patch({ customFields: { [cf.id]: e.target.value || null } })} />
                  ) : (
                    <input type={cf.type === "number" ? "number" : "text"} className={cn(inputCls, "w-full")} defaultValue={val} disabled={!canEdit}
                      placeholder={`Add ${cf.name.toLowerCase()}…`}
                      onBlur={(e) => patch({ customFields: { [cf.id]: cf.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value } })} />
                  )}
                </Field>
              );
            })}
            {showField("watchers") && (
            <Field label="Watchers">
              <span className="flex items-center gap-1 px-2">
                {task.watchers?.slice(0, 5).map((w: Any) => <Avatar key={w._id} user={w} size={20} />)}
                <span className="text-xs text-muted">{task.watchers?.length || 0}</span>
              </span>
            </Field>
            )}

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
                {has("task:delete") && (
                  <button className="btn-ghost !px-2 !py-1.5 text-xs text-red-500" onClick={remove}><Trash2 size={13} /> Delete</button>
                )}
              </div>
            )}
            {task.parentTask && (
              <button onClick={() => navigate(task.parentTask._id)} className="pt-2 text-xs text-muted px-2 hover:text-accent">
                Parent: <span className="text-accent">{task.parentTask.key}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
