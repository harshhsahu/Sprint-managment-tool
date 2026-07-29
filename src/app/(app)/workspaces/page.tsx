"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, Users, Settings, Trash2 } from "lucide-react";
import {
  useQ, useCreateWorkspaceMutation, useDeleteWorkspaceMutation, useCreateProjectMutation,
  useInviteWorkspaceMemberMutation, useUpdateWorkspaceMemberMutation, useRemoveWorkspaceMemberMutation,
} from "@/store/hooks";
import { errMsg } from "@/store/api";
import { Modal, Avatar, Spinner, EmptyState } from "@/components/ui";
import { PlanBadge } from "@/components/PlanBadge";
import { useApp } from "@/components/AppShell";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export default function WorkspacesPage() {
  const { data, isLoading } = useQ.useWorkspaces();
  const { data: projData } = useQ.useProjects();
  const { refresh, me } = useApp();
  const [createWorkspaceM] = useCreateWorkspaceMutation();
  const [deleteWorkspaceM] = useDeleteWorkspaceMutation();
  const [createProjectM] = useCreateProjectMutation();
  const [inviteMemberM] = useInviteWorkspaceMemberMutation();
  const [updateMemberM] = useUpdateWorkspaceMemberMutation();
  const [removeMemberM] = useRemoveWorkspaceMemberMutation();
  const [createWs, setCreateWs] = useState(false);
  const [createProjIn, setCreateProjIn] = useState<Any>(null);
  const [manageWs, setManageWs] = useState<Any>(null);
  const [form, setForm] = useState({ name: "", description: "", key: "" });
  const [invite, setInvite] = useState({ email: "", role: "editor" });
  const [err, setErr] = useState("");

  const workspaces = data?.workspaces || [];
  const projects = projData?.projects || [];

  async function submitWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await createWorkspaceM({ name: form.name, description: form.description }).unwrap();
      setCreateWs(false);
      setForm({ name: "", description: "", key: "" });
      refresh();
    } catch (e) { setErr(errMsg(e)); }
  }

  async function submitProject(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await createProjectM({
        workspace: createProjIn._id, name: form.name, key: form.key, description: form.description,
      }).unwrap();
      setCreateProjIn(null);
      setForm({ name: "", description: "", key: "" });
      refresh();
    } catch (e) { setErr(errMsg(e)); }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const res = await inviteMemberM({ id: manageWs._id, body: invite }).unwrap();
      setManageWs(res.workspace);
      setInvite({ email: "", role: "editor" });
    } catch (e) { setErr(errMsg(e)); }
  }

  async function deleteWorkspace(ws: Any) {
    if (!confirm(`Delete workspace "${ws.name}" and ALL of its projects and tasks? This cannot be undone.`)) return;
    await deleteWorkspaceM(ws._id).unwrap();
    refresh();
  }

  const isWsAdmin = (ws: Any) =>
    String(ws.owner?._id || ws.owner) === me?._id ||
    ws.members?.some((m: Any) => (m.user?._id || m.user) === me?._id && (m.role === "owner" || m.role === "admin"));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted">Organize teams and projects into workspaces.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ name: "", description: "", key: "" }); setCreateWs(true); }}>
          <Plus size={15} /> New workspace
        </button>
      </div>

      {isLoading && <Spinner />}
      {!isLoading && workspaces.length === 0 && (
        <EmptyState
          icon={<Users size={40} />}
          title="No workspaces yet"
          hint="Create your first workspace to start adding projects and teammates."
          action={<button className="btn-primary" onClick={() => setCreateWs(true)}><Plus size={15} /> Create workspace</button>}
        />
      )}

      <div className="space-y-4">
        {workspaces.map((ws: Any) => {
          const wsProjects = projects.filter((p: Any) => (p.workspace?._id || p.workspace) === ws._id);
          return (
            <div key={ws._id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <span className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{ws.name}</h2>
                    <PlanBadge ws={ws} />
                  </span>
                  {ws.description && <p className="mt-0.5 text-sm text-muted">{ws.description}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex -space-x-1.5">
                    {ws.members?.slice(0, 5).map((m: Any) => <Avatar key={m.user?._id} user={m.user} size={24} />)}
                  </span>
                  {isWsAdmin(ws) && (
                    <>
                      <button className="btn-ghost !p-2" title="Members & settings" onClick={() => { setErr(""); setManageWs(ws); }}>
                        <Settings size={14} />
                      </button>
                      {String(ws.owner?._id || ws.owner) === me?._id && (
                        <button className="btn-ghost !p-2 text-red-500" title="Delete workspace" onClick={() => deleteWorkspace(ws)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {wsProjects.map((p: Any) => (
                  <Link key={p._id} href={`/p/${p._id}/board`} className="flex items-center gap-2.5 rounded-lg border border-line p-3 hover:border-accent transition">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent"><FolderKanban size={16} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-muted font-mono">{p.key}</span>
                    </span>
                  </Link>
                ))}
                {isWsAdmin(ws) && (
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line p-3 text-sm text-muted hover:border-accent hover:text-accent transition"
                    onClick={() => { setErr(""); setForm({ name: "", description: "", key: "" }); setCreateProjIn(ws); }}
                  >
                    <Plus size={15} /> New project
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* create workspace */}
      <Modal open={createWs} onClose={() => setCreateWs(false)} title="Create workspace">
        <form onSubmit={submitWorkspace} className="space-y-4">
          <input className="input" placeholder="Workspace name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <textarea className="input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button className="btn-primary w-full">Create workspace</button>
        </form>
      </Modal>

      {/* create project */}
      <Modal open={!!createProjIn} onClose={() => setCreateProjIn(null)} title={`New project in ${createProjIn?.name || ""}`}>
        <form onSubmit={submitProject} className="space-y-4">
          <input className="input" placeholder="Project name" required minLength={2} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, key: form.key || e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() })} autoFocus />
          <div>
            <input className="input font-mono uppercase" placeholder="KEY (e.g. APP)" required minLength={2} maxLength={8} value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} />
            <p className="mt-1 text-xs text-muted">Tasks will be numbered {form.key || "KEY"}-1, {form.key || "KEY"}-2, …</p>
          </div>
          <textarea className="input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button className="btn-primary w-full">Create project</button>
        </form>
      </Modal>

      {/* manage members */}
      <Modal open={!!manageWs} onClose={() => setManageWs(null)} title={`Members — ${manageWs?.name || ""}`}>
        {manageWs && (
          <div className="space-y-4">
            <p className="text-xs text-muted">Workspace members get access to <b>every project</b> in this workspace at their role.</p>
            <form onSubmit={submitInvite} className="flex gap-2">
              <input className="input" type="email" placeholder="teammate@company.com" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <select className="input !w-32" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button className="btn-primary shrink-0">Invite</button>
            </form>
            {err && <p className="text-sm text-red-500">{err}</p>}
            <div className="space-y-2">
              {manageWs.members?.map((m: Any) => {
                const isOwner = String(manageWs.owner?._id || manageWs.owner) === m.user?._id;
                return (
                  <div key={m.user?._id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
                    <Avatar user={m.user} size={26} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.user?.name} {!m.user?.active && <span className="text-xs text-red-500">(deactivated)</span>}</div>
                      <div className="truncate text-xs text-muted">{m.user?.email}</div>
                    </div>
                    {isOwner ? (
                      <span className="ml-auto chip bg-accent/15 text-accent">{ROLE_LABELS.owner}</span>
                    ) : (
                      <select
                        className="ml-auto rounded border border-line bg-card px-2 py-1 text-xs"
                        value={m.role}
                        onChange={async (e) => {
                          const res = await updateMemberM({ id: manageWs._id, userId: m.user._id, role: e.target.value }).unwrap();
                          setManageWs(res.workspace);
                        }}
                      >
                        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    )}
                    {!isOwner && (
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={async () => {
                          await removeMemberM({ id: manageWs._id, userId: m.user._id }).unwrap();
                          // Reflect the removal locally; the Workspaces list refetches via tags.
                          setManageWs({
                            ...manageWs,
                            members: (manageWs.members || []).filter((x: Any) => (x.user?._id || x.user) !== m.user._id),
                          });
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
