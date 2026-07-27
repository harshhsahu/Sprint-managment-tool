import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Project, User, Workspace, Invite } from "@/models";
import { can } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/constants";

async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const ws = await Workspace.findById(workspaceId).select("owner members");
  if (!ws) return false;
  if (String(ws.owner) === userId) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ws.members || []).some((m: any) => String(m.user) === userId);
}

/** List a project's invitations (pending + resolved) — for the settings screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to view invitations", 403);

  const invites = await Invite.find({ project: id })
    .populate("invitedBy", "name email avatarColor")
    .sort({ createdAt: -1 });
  return json({ invites });
}

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(ASSIGNABLE_ROLES).default("editor"),
});

/** Invite someone to a project by email. The email need NOT belong to an existing
    user — the invite waits until they sign in / register with that address. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to invite people", 403);

  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  const email = data.email.toLowerCase();
  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);

  // Already-has-access checks (only meaningful if the email maps to a user).
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (String(existingUser._id) === String(user!._id)) return error("You already have access to this project", 409);
    if (await isWorkspaceMember(String(project.workspace), String(existingUser._id))) {
      return error("That person is a workspace member and already has access to every project", 409);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (project.members.some((m: any) => String(m.user) === String(existingUser._id))) {
      return error("That person is already a member of this project", 409);
    }
  }

  const existingPending = await Invite.findOne({ project: id, email, status: "pending" });
  if (existingPending) return error("There's already a pending invitation for that email", 409);

  // Reuse a previously-resolved invite row for this email if present, else create.
  const invite =
    (await Invite.findOne({ project: id, email })) ||
    new Invite({ project: id, email });
  invite.role = data.role;
  invite.status = "pending";
  invite.invitedBy = user!._id;
  invite.respondedAt = null;
  await invite.save();

  // If they already have an account, light up their notification bell.
  if (existingUser) {
    await notify({
      user: String(existingUser._id),
      type: "invite",
      title: `${user!.name} invited you to "${project.name}"`,
      body: `Role: ${ROLE_LABELS[data.role]}. Accept or decline from your invitations.`,
      actor: String(user!._id),
    });
  }
  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.invited",
    detail: `Invited ${email} as ${ROLE_LABELS[data.role]}`,
  });

  const populated = await Invite.findById(invite._id).populate("invitedBy", "name email avatarColor");
  return json({ invite: populated }, 201);
}

/** Revoke an invitation (?inviteId=). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;
  const inviteId = new URL(req.url).searchParams.get("inviteId");
  if (!inviteId) return error("inviteId is required");

  if (!(await can(user, id, "member:manage"))) return error("You don't have permission to manage invitations", 403);

  const invite = await Invite.findOne({ _id: inviteId, project: id });
  if (!invite) return error("Invitation not found", 404);
  await invite.deleteOne();

  await logActivity({
    project: id,
    user: String(user!._id),
    action: "project.invite_revoked",
    detail: `Revoked invitation for ${invite.email}`,
  });
  return json({ ok: true });
}
