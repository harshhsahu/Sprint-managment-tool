"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Trash2, GripVertical, ArchiveRestore, Archive, Send, Mail } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { fetcher, api } from "@/lib/client";
import { Spinner, Avatar, TypeIcon, StatusBadge } from "@/components/ui";
import TaskModal from "@/components/TaskModal";
import { useProject, ProjectHeader, type Any } from "@/components/project/common";
import { useApp } from "@/components/AppShell";
import { ASSIGNABLE_ROLES, ROLE_LABELS, STATUS_CATEGORIES, OPTIONAL_TASK_FIELDS, REQUIRABLE_TASK_FIELDS, CUSTOM_FIELD_TYPES } from "@/lib/constants";

/** Drop unnamed fields; keep options only for multiselect fields (with named options). */
function normalizeCustomFields(fields: Any[]): Any[] {
  return fields
    .filter((f) => f.name.trim())
    .map((f) =>
      f.type === "multiselect"
        ? { id: f.id, name: f.name.trim(), type: "multiselect", options: (f.options || []).filter((o: Any) => o.name.trim()) }
        : { id: f.id, name: f.name.trim(), type: f.type }
    );
}

export default function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const { project, myRole, myCapabilities, mutate } = useProject(projectId);
  const { refresh } = useApp();
  const [statuses, setStatuses] = useState<Any[]>([]);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Any[]>([]);
  const [info, setInfo] = useState({ name: "", description: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const { data: archivedData, mutate: mutArchived } = useSWR<Any>(`/api/tasks?project=${projectId}&archived=1&limit=200&sort=-updatedAt`, fetcher);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const isAdmin = myCapabilities.includes("project:manage");
  const canManageMembers = myCapabilities.includes("member:manage");
  const canEditTasks = myCapabilities.includes("task:edit");
  const archivedTasks: Any[] = archivedData?.tasks || [];

  const { data: invitesData, mutate: mutInvites } = useSWR<Any>(
    canManageMembers ? `/api/projects/${projectId}/invites` : null,
    fetcher
  );
  const pendingInvites: Any[] = (invitesData?.invites || []).filter((i: Any) => i.status === "pending");

  async function restoreTask(id: string) {
    await api(`/api/tasks/${id}`, "PATCH", { archived: false });
    mutArchived();
  }

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatuses(project.statuses.map((s: Any) => ({ ...s })));
      setHiddenFields([...(project.hiddenFields || [])]);
      setRequiredFields([...(project.requiredFields || [])]);
      setCustomFields((project.customFields || []).map((f: Any) => ({ ...f })));
      setInfo({ name: project.name, description: project.description || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?._id, project?.updatedAt]);

  async function save(patch: Any, note: string) {
    setErr(""); setMsg("");
    try {
      await api(`/api/projects/${projectId}`, "PATCH", patch);
      setMsg(note);
      mutate(); refresh();
      setTimeout(() => setMsg(""), 2500);
    } catch (e) { setErr((e as Error).message); }
  }

  function onStatusDrag(r: DropResult) {
    if (!r.destination) return;
    const next = [...statuses];
    const [moved] = next.splice(r.source.index, 1);
    next.splice(r.destination.index, 0, moved);
    setStatuses(next.map((s, i) => ({ ...s, order: i })));
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setErr(""); setMsg("");
    try {
      await api(`/api/projects/${projectId}/invites`, "POST", { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      setMsg(`Invitation sent to ${inviteEmail.trim()}`);
      setTimeout(() => setMsg(""), 2500);
      mutInvites();
    } catch (e) { setErr((e as Error).message); }
  }

  async function revokeInvite(id: string) {
    await api(`/api/projects/${projectId}/invites?inviteId=${id}`, "DELETE");
    mutInvites();
  }

  async function deleteProject() {
    if (!confirm(`Delete project "${project.name}" and ALL its tasks and sprints? This cannot be undone.`)) return;
    await api(`/api/projects/${projectId}`, "DELETE");
    refresh();
    router.push("/workspaces");
  }

  if (!project) return <Spinner label="Loading settings…" />;

  // Everyone in the workspace already has access to this project (read-only here —
  // managed at the workspace level). Project "guests" are users outside the workspace.
  const wsOwner = project.workspace?.owner;
  const excludedPeople = (project.excludedMembers || []) as Any[];
  const excludedIds = new Set(excludedPeople.map((u: Any) => String(u?._id ?? u)));
  const workspacePeople: Any[] = [
    ...(wsOwner ? [{ user: wsOwner, role: "owner" }] : []),
    ...((project.workspace?.members || []) as Any[]).filter((m) => m.user?._id !== wsOwner?._id),
  ].filter((m) => !excludedIds.has(String(m.user?._id)));
  const guests = (project.members || []) as Any[];

  const excludeMember = async (userId: string) => {
    await api(`/api/projects/${projectId}/members?userId=${userId}`, "DELETE");
    mutate();
  };
  const restoreMember = async (userId: string) => {
    await api(`/api/projects/${projectId}/members`, "POST", { userId });
    mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 pb-16">
      <ProjectHeader project={project} title="Settings" />
      {!isAdmin && <p className="card p-3 text-sm text-muted">You have the <b>{ROLE_LABELS[myRole || ""] || myRole}</b> role — settings are read-only.</p>}
      {msg && <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">{msg}</p>}
      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{err}</p>}

      {/* general */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">General</h2>
        <div className="space-y-3">
          <input className="input" disabled={!isAdmin} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          <textarea className="input" disabled={!isAdmin} placeholder="Project description" value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
          {isAdmin && <button className="btn-primary" onClick={() => save(info, "Project details saved")}>Save details</button>}
        </div>
      </section>

      {/* team via workspace (read-only) */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Team access</h2>
        <p className="mb-3 text-xs text-muted">Everyone in the <b>{project.workspace?.name}</b> workspace has access to this project at their workspace role. Roles are managed from <span className="font-medium">Workspaces → Members</span>; here you can remove someone from <b>this project only</b>.</p>
        <div className="space-y-2">
          {workspacePeople.map((m: Any) => (
            <div key={m.user?._id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
              <Avatar user={m.user} size={26} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.user?.name} {!m.user?.active && <span className="text-xs text-red-500">(deactivated)</span>}</div>
                <div className="truncate text-xs text-muted">{m.user?.designation || m.user?.email}</div>
              </div>
              <span className="ml-auto chip bg-accent/15 text-accent">{ROLE_LABELS[m.role] || m.role}</span>
              {canManageMembers && m.role !== "owner" && (
                <button className="text-xs text-red-500 hover:underline" onClick={() => excludeMember(m.user._id)}>
                  Remove
                </button>
              )}
            </div>
          ))}
          {workspacePeople.length === 0 && <p className="text-sm text-muted">No workspace members.</p>}
        </div>

        {excludedPeople.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase text-muted">Removed from this project</div>
            <p className="mb-2 text-xs text-muted">These workspace members have been removed from this project. They keep their access to every other project.</p>
            <div className="space-y-2">
              {excludedPeople.map((u: Any) => (
                <div key={u?._id} className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2 opacity-70">
                  <Avatar user={u} size={26} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u?.name}</div>
                    <div className="truncate text-xs text-muted">{u?.designation || u?.email}</div>
                  </div>
                  {canManageMembers && (
                    <button className="ml-auto text-xs text-accent hover:underline" onClick={() => restoreMember(u._id)}>
                      Restore access
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* project guests */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Project guests</h2>
        <p className="mb-3 text-xs text-muted">Invite anyone by email to access <b>this project only</b>. They don&apos;t need an account yet — the invitation waits for them and they choose to accept or decline when they sign in.</p>
        {canManageMembers && (
          <form onSubmit={sendInvite} className="mb-4 flex flex-wrap gap-2">
            <input
              className="input min-w-56 flex-1"
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select className="input !w-32" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button className="btn-primary shrink-0" disabled={!inviteEmail.trim()}><Send size={14} /> Invite</button>
          </form>
        )}

        {/* pending invitations */}
        {canManageMembers && pendingInvites.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-semibold uppercase text-muted">Pending invitations</div>
            <div className="space-y-2">
              {pendingInvites.map((inv: Any) => (
                <div key={inv._id} className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2">
                  <Mail size={16} className="text-muted" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{inv.email}</div>
                    <div className="truncate text-xs text-muted">Invited by {inv.invitedBy?.name || "someone"} · awaiting response</div>
                  </div>
                  <span className="ml-auto chip bg-amber-500/15 text-amber-600">{ROLE_LABELS[inv.role] || inv.role}</span>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => revokeInvite(inv._id)}>Revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {guests.map((m: Any) => (
            <div key={m.user?._id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
              <Avatar user={m.user} size={26} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.user?.name}</div>
                <div className="truncate text-xs text-muted">{m.user?.designation || m.user?.email}</div>
              </div>
              <select
                className="ml-auto rounded border border-line bg-card px-2 py-1 text-xs"
                value={m.role}
                disabled={!canManageMembers}
                onChange={async (e) => { await api(`/api/projects/${projectId}/members`, "PATCH", { userId: m.user._id, role: e.target.value }); mutate(); }}
              >
                {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                {!(ASSIGNABLE_ROLES as readonly string[]).includes(m.role) && <option value={m.role}>{m.role}</option>}
              </select>
              {canManageMembers && (
                <button className="text-xs text-red-500 hover:underline" onClick={async () => { await api(`/api/projects/${projectId}/members?userId=${m.user._id}`, "DELETE"); mutate(); }}>
                  Remove
                </button>
              )}
            </div>
          ))}
          {guests.length === 0 && <p className="text-sm text-muted">No project guests.</p>}
        </div>
      </section>

      {/* workflow statuses */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Workflow statuses</h2>
        <p className="mb-3 text-xs text-muted">Drag to reorder columns. WIP limit 0 = unlimited. Category drives done/burndown logic.</p>
        <DragDropContext onDragEnd={onStatusDrag}>
          <Droppable droppableId="statuses">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {statuses.map((s, i) => (
                  <Draggable draggableId={s.id} index={i} key={s.id} isDragDisabled={!isAdmin}>
                    {(dp) => (
                      <div ref={dp.innerRef} {...dp.draggableProps} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-2 py-2">
                        <span {...dp.dragHandleProps} className="text-muted cursor-grab"><GripVertical size={14} /></span>
                        <input type="color" className="h-7 w-8 cursor-pointer rounded border border-line bg-transparent" disabled={!isAdmin} value={s.color}
                          onChange={(e) => setStatuses(statuses.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))} />
                        <input className="input !w-40 !py-1 text-sm" disabled={!isAdmin} value={s.name}
                          onChange={(e) => setStatuses(statuses.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} />
                        <select className="input !w-32 !py-1 text-xs" disabled={!isAdmin} value={s.category}
                          onChange={(e) => setStatuses(statuses.map((x, xi) => (xi === i ? { ...x, category: e.target.value } : x)))}>
                          {STATUS_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-muted">
                          WIP
                          <input type="number" min={0} max={100} className="input !w-16 !py-1 text-xs" disabled={!isAdmin} value={s.wipLimit}
                            onChange={(e) => setStatuses(statuses.map((x, xi) => (xi === i ? { ...x, wipLimit: Number(e.target.value) } : x)))} />
                        </label>
                        {isAdmin && statuses.length > 1 && (
                          <button className="ml-auto text-red-500" onClick={() => setStatuses(statuses.filter((_, xi) => xi !== i))}><Trash2 size={14} /></button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        {isAdmin && (
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost" onClick={() => setStatuses([...statuses, { id: `st_${statuses.length}_${statuses.map(s=>s.id).join("").length}`, name: "New status", color: "#64748b", category: "todo", order: statuses.length, wipLimit: 0 }])}>
              <Plus size={14} /> Add status
            </button>
            <button className="btn-primary" onClick={() => save({ statuses: statuses.map((s, i) => ({ ...s, order: i })) }, "Workflow saved. Tasks in removed statuses moved to the first column.")}>
              Save workflow
            </button>
          </div>
        )}
      </section>

      {/* task fields */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Task fields</h2>
        <p className="mb-3 text-xs text-muted">Choose which built-in fields appear on tasks, and add your own (e.g. an ETA date).</p>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase text-muted">Built-in fields</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {OPTIONAL_TASK_FIELDS.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={!hiddenFields.includes(f.id)}
                  onChange={(e) =>
                    setHiddenFields(e.target.checked ? hiddenFields.filter((x) => x !== f.id) : [...hiddenFields, f.id])
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase text-muted">Required on new tasks</div>
          <p className="mb-2 text-xs text-muted">When any are checked, adding a task opens the full form so these can be filled in. Tasks still save even if left blank — they&apos;re never blocked or flagged.</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {REQUIRABLE_TASK_FIELDS.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={requiredFields.includes(f.id)}
                  onChange={(e) =>
                    setRequiredFields(e.target.checked ? [...requiredFields, f.id] : requiredFields.filter((x) => x !== f.id))
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-muted">Custom fields</div>
          <p className="mb-2 text-xs text-muted">Add your own fields. A <b>multiselect</b> field carries its own colored options — use it for things like labels, components or teams.</p>
          <div className="space-y-2">
            {customFields.map((f, i) => {
              const setField = (patch: Any) => setCustomFields(customFields.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
              return (
                <div key={f.id} className="rounded-lg border border-line p-2">
                  <div className="flex items-center gap-2">
                    <input className="input !w-52 !py-1 text-sm" disabled={!isAdmin} placeholder="Field name (e.g. ETA)" value={f.name}
                      onChange={(e) => setField({ name: e.target.value })} />
                    <select className="input !w-32 !py-1 text-xs" disabled={!isAdmin} value={f.type}
                      onChange={(e) => setField(e.target.value === "multiselect" ? { type: "multiselect", options: f.options || [] } : { type: e.target.value })}>
                      {CUSTOM_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {isAdmin && <button className="text-red-500" onClick={() => setCustomFields(customFields.filter((_, xi) => xi !== i))}><Trash2 size={14} /></button>}
                  </div>
                  {f.type === "multiselect" && (
                    <div className="mt-2 space-y-1.5 border-t border-line pt-2 pl-1">
                      <div className="text-xs text-muted">Options</div>
                      {(f.options || []).map((o: Any, oi: number) => (
                        <div key={o.id} className="flex items-center gap-2">
                          <input type="color" className="h-6 w-7 cursor-pointer rounded border border-line bg-transparent" disabled={!isAdmin} value={o.color}
                            onChange={(e) => setField({ options: f.options.map((x: Any, xi: number) => (xi === oi ? { ...x, color: e.target.value } : x)) })} />
                          <input className="input !w-48 !py-1 text-sm" disabled={!isAdmin} placeholder="Option name" value={o.name}
                            onChange={(e) => setField({ options: f.options.map((x: Any, xi: number) => (xi === oi ? { ...x, name: e.target.value } : x)) })} />
                          {isAdmin && <button className="text-red-500" onClick={() => setField({ options: f.options.filter((_: Any, xi: number) => xi !== oi) })}><Trash2 size={13} /></button>}
                        </div>
                      ))}
                      {isAdmin && (
                        <button className="btn-ghost !py-1 text-xs" onClick={() => setField({ options: [...(f.options || []), { id: `opt_${Date.now().toString(36)}_${(f.options || []).length}`, name: "New option", color: "#3b82f6" }] })}>
                          <Plus size={12} /> Add option
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {customFields.length === 0 && <p className="text-sm text-muted">No custom fields.</p>}
          </div>
          {isAdmin && (
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost" onClick={() => setCustomFields([...customFields, { id: `cf_${Date.now().toString(36)}_${customFields.length}`, name: "New field", type: "text" }])}>
                <Plus size={14} /> Add field
              </button>
              <button className="btn-primary" onClick={() => save({ hiddenFields, requiredFields, customFields: normalizeCustomFields(customFields) }, "Task fields saved")}>Save fields</button>
            </div>
          )}
        </div>
      </section>

      {/* archived tasks */}
      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Archive size={16} /> Archived tasks</h2>
        <p className="mb-3 text-xs text-muted">Tasks archived from the board or backlog. Restore one to bring it back to its status column.</p>
        {!archivedData ? (
          <Spinner label="Loading archived tasks…" />
        ) : archivedTasks.length === 0 ? (
          <p className="text-sm text-muted">No archived tasks.</p>
        ) : (
          <div className="space-y-1.5">
            {archivedTasks.map((t: Any) => (
              <div key={t._id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm transition hover:border-accent">
                <button onClick={() => setOpenTask(t._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={`Open ${t.key}`}>
                  <TypeIcon type={t.type} size={12} />
                  <span className="font-mono text-xs text-muted">{t.key}</span>
                  <span className="truncate">{t.title}</span>
                  <StatusBadge status={t.status} statuses={project.statuses} />
                </button>
                <Avatar user={t.assignee} size={20} />
                {canEditTasks && (
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => restoreTask(t._id)} title="Restore from archive">
                    <ArchiveRestore size={13} /> Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* danger zone */}
      {isAdmin && (
        <section className="card border-red-500/40 p-5">
          <h2 className="mb-2 font-semibold text-red-500">Danger zone</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => save({ archived: !project.archived }, project.archived ? "Project unarchived" : "Project archived")}>
              {project.archived ? "Unarchive project" : "Archive project"}
            </button>
            <button className="btn-danger" onClick={deleteProject}><Trash2 size={14} /> Delete project</button>
          </div>
        </section>
      )}

      {openTask && (
        <TaskModal
          taskId={openTask}
          project={project}
          onClose={() => setOpenTask(null)}
          onChanged={() => mutArchived()}
        />
      )}
    </div>
  );
}
