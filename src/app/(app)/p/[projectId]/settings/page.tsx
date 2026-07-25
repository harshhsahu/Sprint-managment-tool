"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { fetcher, api } from "@/lib/client";
import { Spinner, Avatar } from "@/components/ui";
import { useProject, ProjectHeader, type Any } from "@/components/project/common";
import { useApp } from "@/components/AppShell";
import { PROJECT_ROLES, ROLE_LABELS, STATUS_CATEGORIES } from "@/lib/constants";

export default function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const { project, myRole, myCapabilities, pendingInvites, mutate } = useProject(projectId);
  const { refresh } = useApp();
  const [statuses, setStatuses] = useState<Any[]>([]);
  const [labels, setLabels] = useState<Any[]>([]);
  const [info, setInfo] = useState({ name: "", description: "" });
  const [addUserId, setAddUserId] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("developer");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const { data: usersData } = useSWR<Any>("/api/users", fetcher);
  const isAdmin = myCapabilities.includes("project:manage");
  const canManageMembers = myCapabilities.includes("member:manage");

  useEffect(() => {
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatuses(project.statuses.map((s: Any) => ({ ...s })));
      setLabels(project.labels.map((l: Any) => ({ ...l })));
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

  async function addMember() {
    if (!addUserId) return;
    setErr("");
    try {
      await api(`/api/projects/${projectId}/members`, "POST", { userId: addUserId, role: addRole });
      setAddUserId("");
      mutate();
    } catch (e) { setErr((e as Error).message); }
  }

  async function inviteByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail) return;
    setErr("");
    try {
      await api(`/api/projects/${projectId}/members`, "POST", { email: addEmail, role: addRole });
      setAddEmail("");
      mutate();
    } catch (e) { setErr((e as Error).message); }
  }

  async function revokeInvite(email: string) {
    setErr("");
    try {
      await api(`/api/projects/${projectId}/members?email=${encodeURIComponent(email)}`, "DELETE");
      mutate();
    } catch (e) { setErr((e as Error).message); }
  }

  async function deleteProject() {
    if (!confirm(`Delete project "${project.name}" and ALL its tasks and sprints? This cannot be undone.`)) return;
    await api(`/api/projects/${projectId}`, "DELETE");
    refresh();
    router.push("/workspaces");
  }

  if (!project) return <Spinner label="Loading settings…" />;

  const memberIds = new Set((project.members || []).map((m: Any) => m.user?._id));
  const candidates = (usersData?.users || []).filter((u: Any) => !memberIds.has(u._id));
  const roleOptions: { id: string; name: string }[] = [
    ...PROJECT_ROLES.map((r) => ({ id: r, name: ROLE_LABELS[r] })),
    ...((project.workspace?.customRoles || []) as Any[]).map((r) => ({ id: r.id, name: `${r.name} (custom)` })),
  ];

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

      {/* members */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Members & roles</h2>
        {canManageMembers && (
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <select className="input !w-64" value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">Add an existing user…</option>
                {candidates.map((u: Any) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
              </select>
              <select className="input !w-40" value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                {roleOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="btn-primary" onClick={addMember} disabled={!addUserId}><Plus size={14} /> Add</button>
            </div>
            <form onSubmit={inviteByEmail} className="flex flex-wrap gap-2">
              <input className="input !w-64" type="email" placeholder="Invite by email…" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
              <button className="btn-ghost" type="submit" disabled={!addEmail}><Plus size={14} /> Invite</button>
            </form>
            <p className="text-xs text-muted">
              Invite anyone by email — registered users join now; new people join automatically when they sign up with that email. New members take the role selected above.
            </p>
          </div>
        )}

        {canManageMembers && pendingInvites.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-muted">Pending invitations</p>
            {pendingInvites.map((p: Any) => (
              <div key={p.email} className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-amber-500/15 text-amber-600 text-xs font-medium">
                  {p.email[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.email}</div>
                  <div className="truncate text-xs text-muted">
                    {ROLE_LABELS[p.role] || p.role} · <span className="text-amber-600">awaiting registration</span>
                  </div>
                </div>
                <button className="ml-auto text-xs text-red-500 hover:underline" onClick={() => revokeInvite(p.email)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {(project.members || []).map((m: Any) => (
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
                {roleOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                {!roleOptions.some((r) => r.id === m.role) && <option value={m.role}>{m.role}</option>}
              </select>
              {canManageMembers && (
                <button className="text-xs text-red-500 hover:underline" onClick={async () => { await api(`/api/projects/${projectId}/members?userId=${m.user._id}`, "DELETE"); mutate(); }}>
                  Remove
                </button>
              )}
            </div>
          ))}
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

      {/* labels */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Labels</h2>
        <div className="space-y-2">
          {labels.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2">
              <input type="color" className="h-7 w-8 cursor-pointer rounded border border-line bg-transparent" disabled={!isAdmin} value={l.color}
                onChange={(e) => setLabels(labels.map((x, xi) => (xi === i ? { ...x, color: e.target.value } : x)))} />
              <input className="input !w-52 !py-1 text-sm" disabled={!isAdmin} value={l.name}
                onChange={(e) => setLabels(labels.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} />
              {isAdmin && <button className="text-red-500" onClick={() => setLabels(labels.filter((_, xi) => xi !== i))}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost" onClick={() => setLabels([...labels, { id: `lb_${labels.length}_${labels.map(l=>l.id).join("").length}`, name: "new-label", color: "#3b82f6" }])}>
              <Plus size={14} /> Add label
            </button>
            <button className="btn-primary" onClick={() => save({ labels }, "Labels saved")}>Save labels</button>
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
    </div>
  );
}
