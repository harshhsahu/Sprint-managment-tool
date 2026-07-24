import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Workspace, User, Project } from "@/models";
import { getWorkspaceRole } from "@/lib/permissions";

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["workspace_admin", "member"]).default("member"),
});

/** Invite (add) an existing user to the workspace by email. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const myRole = await getWorkspaceRole(user, id);
  if (myRole !== "workspace_admin") return error("Only workspace admins can invite members", 403);

  const { data, res: bodyErr } = await parseBody(req, addSchema);
  if (bodyErr) return bodyErr;

  const invitee = await User.findOne({ email: data.email.toLowerCase(), active: true });
  if (!invitee) return error("No active user found with that email. Ask them to register first.", 404);

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (workspace.members.some((m: any) => String(m.user) === String(invitee._id))) {
    return error("User is already a member of this workspace", 409);
  }

  workspace.members.push({ user: invitee._id, role: data.role });
  await workspace.save();

  // Automatically add the invitee to every project in the workspace.
  const projectRole = data.role === "workspace_admin" ? "project_admin" : "developer";
  const projects = await Project.find({ workspace: id });
  for (const project of projects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (project.members.some((m: any) => String(m.user) === String(invitee._id))) continue;
    project.members.push({ user: invitee._id, role: projectRole });
    await project.save();
  }

  await notify({
    user: String(invitee._id),
    type: "invite",
    title: `You were added to workspace "${workspace.name}"`,
    link: `/w/${workspace._id}`,
    actor: String(user!._id),
  });
  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.member_added",
    detail: `Added ${invitee.name} as ${data.role.replace("_", " ")} (added to ${projects.length} project(s))`,
  });

  const updated = await Workspace.findById(id).populate("members.user", "name email avatarColor designation active");
  return json({ workspace: updated }, 201);
}

const patchSchema = z.object({
  userId: z.string(),
  role: z.enum(["workspace_admin", "member"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const myRole = await getWorkspaceRole(user, id);
  if (myRole !== "workspace_admin") return error("Only workspace admins can change roles", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = workspace.members.find((m: any) => String(m.user) === data.userId);
  if (!member) return error("Member not found", 404);

  member.role = data.role;
  await workspace.save();

  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.role_changed",
    detail: `Changed a member's role to ${data.role.replace("_", " ")}`,
  });
  const updated = await Workspace.findById(id).populate("members.user", "name email avatarColor designation active");
  return json({ workspace: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return error("userId is required");

  const myRole = await getWorkspaceRole(user, id);
  const removingSelf = userId === String(user!._id);
  if (myRole !== "workspace_admin" && !removingSelf) {
    return error("Only workspace admins can remove members", 403);
  }

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  if (String(workspace.owner) === userId) return error("The workspace owner cannot be removed", 400);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace.members = workspace.members.filter((m: any) => String(m.user) !== userId);
  await workspace.save();

  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.member_removed",
    detail: removingSelf ? "Left the workspace" : "Removed a member",
  });
  return json({ ok: true });
}
