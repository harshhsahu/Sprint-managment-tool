import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Project, User, Workspace } from "@/models";
import { can } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/constants";

/** Project members here are GUESTS: users NOT in the workspace, given access to a
    single project. Workspace members already have access and are managed at the
    workspace level. */
async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const ws = await Workspace.findById(workspaceId).select("owner members");
  if (!ws) return false;
  if (String(ws.owner) === userId) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ws.members || []).some((m: any) => String(m.user) === userId);
}

const addSchema = z.object({ userId: z.string(), role: z.enum(ASSIGNABLE_ROLES).default("editor") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to add members", 403);

  const { data, res: bodyErr } = await parseBody(req, addSchema);
  if (bodyErr) return bodyErr;

  const member = await User.findById(data.userId);
  if (!member || !member.active) return error("User not found or inactive", 404);

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);
  if (await isWorkspaceMember(String(project.workspace), data.userId)) {
    return error("This user is a workspace member and already has access to every project", 409);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (project.members.some((m: any) => String(m.user) === data.userId)) {
    return error("User is already a project guest", 409);
  }

  project.members.push({ user: member._id, role: data.role });
  await project.save();

  await notify({
    user: data.userId,
    type: "invite",
    title: `You were added to project "${project.name}"`,
    link: `/p/${project._id}/board`,
    actor: String(user!._id),
  });
  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.member_added",
    detail: `Added ${member.name} as project guest (${ROLE_LABELS[data.role]})`,
  });

  const updated = await Project.findById(id).populate("members.user", "name email avatarColor designation active");
  return json({ project: updated }, 201);
}

const patchSchema = z.object({ userId: z.string(), role: z.enum(ASSIGNABLE_ROLES) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to change roles", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = project.members.find((m: any) => String(m.user) === data.userId);
  if (!member) return error("Member not found", 404);

  member.role = data.role;
  await project.save();

  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.role_changed",
    detail: `Changed a guest's role to ${ROLE_LABELS[data.role]}`,
  });
  const updated = await Project.findById(id).populate("members.user", "name email avatarColor designation active");
  return json({ project: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return error("userId is required");

  const removingSelf = userId === String(user!._id);
  if (!removingSelf && !(await can(user, id, "member:manage"))) {
    return error("You don't have permission to remove members", 403);
  }

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project.members = project.members.filter((m: any) => String(m.user) !== userId);
  await project.save();

  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.member_removed",
    detail: removingSelf ? "Left the project" : "Removed a member",
  });
  return json({ ok: true });
}
