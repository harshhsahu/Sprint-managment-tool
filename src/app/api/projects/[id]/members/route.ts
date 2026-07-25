import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Project, User, Workspace, ProjectInvite } from "@/models";
import { can } from "@/lib/permissions";
import { addUserToProject } from "@/lib/invites";
import { PROJECT_ROLES, ROLE_LABELS } from "@/lib/constants";

/** A role is valid if it is a built-in project role or a custom role defined
    on the project's workspace. */
async function isValidRole(workspaceId: string, role: string): Promise<boolean> {
  if ((PROJECT_ROLES as readonly string[]).includes(role)) return true;
  const ws = await Workspace.findById(workspaceId).select("customRoles");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ws?.customRoles || []).some((r: any) => r.id === role);
}

function roleLabel(role: string) {
  return ROLE_LABELS[role] || role;
}

const addSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    role: z.string().default("developer"),
  })
  .refine((d) => d.userId || d.email, { message: "userId or email is required" });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to add members", 403);

  const { data, res: bodyErr } = await parseBody(req, addSchema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);
  if (!(await isValidRole(String(project.workspace), data.role))) return error("Unknown role", 422);

  // Resolve the target user: by id (existing-user picker) or by email (invite).
  const member = data.userId
    ? await User.findById(data.userId)
    : await User.findOne({ email: data.email!.toLowerCase() });

  // Invite by email to someone without an account yet — record a pending invite.
  if (!member && data.email) {
    const email = data.email.toLowerCase();
    const existing = await ProjectInvite.findOne({ project: id, email });
    if (existing) {
      existing.role = data.role;
      existing.invitedBy = user!._id;
      await existing.save();
    } else {
      await ProjectInvite.create({ project: id, workspace: project.workspace, email, role: data.role, invitedBy: user!._id });
    }
    await logActivity({
      project: id,
      workspace: String(project.workspace),
      user: String(user!._id),
      action: "project.member_invited",
      detail: `Invited ${email} as ${roleLabel(data.role)} (pending registration)`,
    });
    const updated = await Project.findById(id).populate("members.user", "name email avatarColor designation active");
    const pendingInvites = await ProjectInvite.find({ project: id }).select("email role createdAt").sort({ createdAt: 1 });
    return json({ project: updated, pendingInvites, pending: true }, 201);
  }

  if (!member || !member.active) return error("User not found or inactive", 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (project.members.some((m: any) => String(m.user) === String(member._id))) {
    return error("User is already a project member", 409);
  }

  await addUserToProject(project, String(member._id), data.role);

  await notify({
    user: String(member._id),
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
    detail: `Added ${member.name} as ${roleLabel(data.role)}`,
  });

  const updated = await Project.findById(id).populate("members.user", "name email avatarColor designation active");
  const pendingInvites = await ProjectInvite.find({ project: id }).select("email role createdAt").sort({ createdAt: 1 });
  return json({ project: updated, pendingInvites }, 201);
}

const patchSchema = z.object({ userId: z.string(), role: z.string() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to change roles", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);
  if (!(await isValidRole(String(project.workspace), data.role))) return error("Unknown role", 422);
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
    detail: `Changed a member's role to ${roleLabel(data.role)}`,
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
  const email = searchParams.get("email");
  if (!userId && !email) return error("userId or email is required");

  // Revoke a pending (not-yet-registered) invitation by email.
  if (email) {
    if (!(await can(user, id, "member:manage"))) return error("You don't have permission to revoke invitations", 403);
    await ProjectInvite.deleteOne({ project: id, email: email.toLowerCase() });
    await logActivity({
      project: id,
      user: String(user!._id),
      action: "project.invite_revoked",
      detail: `Revoked the invitation for ${email.toLowerCase()}`,
    });
    return json({ ok: true });
  }

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
