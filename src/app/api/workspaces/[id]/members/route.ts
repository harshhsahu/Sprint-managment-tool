import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Workspace, User, Project } from "@/models";
import { getWorkspaceRole, isWorkspaceManager } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/constants";

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(ASSIGNABLE_ROLES).default("editor"),
});

/** Invite (add) an existing user to the workspace by email. Workspace membership
    grants access to every project in the workspace — no per-project invite needed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const myRole = await getWorkspaceRole(user, id);
  if (!isWorkspaceManager(myRole)) return error("Only workspace owners and admins can invite members", 403);

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

  // If they were a guest on any project in this workspace, drop the guest entry —
  // their workspace membership now grants access at their workspace role.
  await Project.updateMany({ workspace: id }, { $pull: { members: { user: invitee._id } } });

  await notify({
    user: String(invitee._id),
    type: "invite",
    title: `You were added to workspace "${workspace.name}"`,
    link: `/workspaces`,
    actor: String(user!._id),
  });
  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.member_added",
    detail: `Added ${invitee.name} as ${ROLE_LABELS[data.role]} (access to all projects)`,
  });

  const updated = await Workspace.findById(id).populate("members.user", "name email avatarColor designation active");
  return json({ workspace: updated }, 201);
}

const patchSchema = z.object({
  userId: z.string(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const myRole = await getWorkspaceRole(user, id);
  if (!isWorkspaceManager(myRole)) return error("Only workspace owners and admins can change roles", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  // The owner is permanently the owner — their role can't be changed.
  if (String(workspace.owner) === data.userId) return error("The workspace owner's role cannot be changed", 400);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = workspace.members.find((m: any) => String(m.user) === data.userId);
  if (!member) return error("Member not found", 404);

  member.role = data.role;
  await workspace.save();

  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.role_changed",
    detail: `Changed a member's role to ${ROLE_LABELS[data.role]}`,
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
  if (!isWorkspaceManager(myRole) && !removingSelf) {
    return error("Only workspace owners and admins can remove members", 403);
  }

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  if (String(workspace.owner) === userId) return error("The workspace owner cannot be removed", 400);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace.members = workspace.members.filter((m: any) => String(m.user) !== userId);
  await workspace.save();

  // Cascade: removing someone from the workspace revokes their access to every
  // project in it (otherwise they'd keep project access via their membership).
  await Project.updateMany({ workspace: id }, { $pull: { members: { user: userId } } });
  // If they led any project, hand the lead back to the workspace owner so the
  // project isn't left with a lead who no longer has access.
  await Project.updateMany({ workspace: id, lead: userId }, { $set: { lead: workspace.owner } });

  await logActivity({
    workspace: id,
    user: String(user!._id),
    action: "workspace.member_removed",
    detail: removingSelf ? "Left the workspace (removed from all projects)" : "Removed a member (revoked from all projects)",
  });
  return json({ ok: true });
}
