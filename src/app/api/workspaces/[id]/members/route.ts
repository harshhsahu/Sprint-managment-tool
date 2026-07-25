import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Workspace, User, WorkspaceInvite } from "@/models";
import { getWorkspaceRole } from "@/lib/permissions";
import { addUserToWorkspace } from "@/lib/invites";

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["workspace_admin", "member"]).default("member"),
});

/** Invite a user to the workspace by email. If the email already has an
    account they join immediately; otherwise the invitation is stored and
    applied automatically when they register. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const myRole = await getWorkspaceRole(user, id);
  if (myRole !== "workspace_admin") return error("Only workspace admins can invite members", 403);

  const { data, res: bodyErr } = await parseBody(req, addSchema);
  if (bodyErr) return bodyErr;

  const email = data.email.toLowerCase();

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);

  const invitee = await User.findOne({ email });

  // No account yet — record (or update) a pending invitation.
  if (!invitee || !invitee.active) {
    if (invitee && !invitee.active) return error("That account is deactivated.", 409);
    const existing = await WorkspaceInvite.findOne({ workspace: id, email });
    if (existing) {
      existing.role = data.role;
      existing.invitedBy = user!._id;
      await existing.save();
    } else {
      await WorkspaceInvite.create({ workspace: id, email, role: data.role, invitedBy: user!._id });
    }
    await logActivity({
      workspace: id,
      user: String(user!._id),
      action: "workspace.member_invited",
      detail: `Invited ${email} as ${data.role.replace("_", " ")} (pending registration)`,
    });
    const updated = await Workspace.findById(id).populate("members.user", "name email avatarColor designation active");
    const pendingInvites = await WorkspaceInvite.find({ workspace: id }).select("email role createdAt").sort({ createdAt: 1 });
    return json({ workspace: updated, pendingInvites, pending: true }, 201);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (workspace.members.some((m: any) => String(m.user) === String(invitee._id))) {
    return error("User is already a member of this workspace", 409);
  }

  // Existing account — join immediately, across the workspace and its projects.
  const projectCount = await addUserToWorkspace(workspace, String(invitee._id), data.role);

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
    detail: `Added ${invitee.name} as ${data.role.replace("_", " ")} (added to ${projectCount} project(s))`,
  });

  const updated = await Workspace.findById(id).populate("members.user", "name email avatarColor designation active");
  const pendingInvites = await WorkspaceInvite.find({ workspace: id }).select("email role createdAt").sort({ createdAt: 1 });
  return json({ workspace: updated, pendingInvites }, 201);
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
  const email = searchParams.get("email");
  if (!userId && !email) return error("userId or email is required");

  const myRole = await getWorkspaceRole(user, id);

  // Revoke a pending (not-yet-registered) invitation by email.
  if (email) {
    if (myRole !== "workspace_admin") return error("Only workspace admins can revoke invitations", 403);
    await WorkspaceInvite.deleteOne({ workspace: id, email: email.toLowerCase() });
    await logActivity({
      workspace: id,
      user: String(user!._id),
      action: "workspace.invite_revoked",
      detail: `Revoked the invitation for ${email.toLowerCase()}`,
    });
    return json({ ok: true });
  }

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
