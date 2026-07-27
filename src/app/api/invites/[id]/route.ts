import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Invite, Project, Workspace } from "@/models";
import { ROLE_LABELS } from "@/lib/constants";

const schema = z.object({ action: z.enum(["accept", "reject"]) });

/** Accept or reject an invitation addressed to the current user. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  const invite = await Invite.findById(id);
  if (!invite) return error("Invitation not found", 404);
  // Only the person the invite is addressed to may respond.
  if (invite.email !== user!.email) return error("This invitation isn't addressed to you", 403);
  if (invite.status !== "pending") return error("This invitation has already been answered", 409);

  const project = await Project.findById(invite.project);
  if (!project) {
    await invite.deleteOne();
    return error("The project no longer exists", 404);
  }

  invite.status = data.action === "accept" ? "accepted" : "rejected";
  invite.respondedAt = new Date();
  await invite.save();

  if (data.action === "accept") {
    // Grant access as a project guest — unless a workspace membership already covers it.
    const ws = await Workspace.findById(project.workspace).select("owner members");
    const isWsMember =
      ws &&
      (String(ws.owner) === String(user!._id) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ws.members || []).some((m: any) => String(m.user) === String(user!._id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alreadyGuest = project.members.some((m: any) => String(m.user) === String(user!._id));
    if (!isWsMember && !alreadyGuest) {
      project.members.push({ user: user!._id, role: invite.role });
      await project.save();
    }
    await notify({
      user: String(invite.invitedBy),
      type: "invite",
      title: `${user!.name} joined "${project.name}"`,
      link: `/p/${project._id}/board`,
      actor: String(user!._id),
    });
    await logActivity({
      project: String(project._id),
      workspace: String(project.workspace),
      user: String(user!._id),
      action: "project.invite_accepted",
      detail: `Accepted the invitation (${ROLE_LABELS[invite.role]})`,
    });
  } else {
    await notify({
      user: String(invite.invitedBy),
      type: "invite",
      title: `${user!.name} declined the invitation to "${project.name}"`,
      actor: String(user!._id),
    });
    await logActivity({
      project: String(project._id),
      workspace: String(project.workspace),
      user: String(user!._id),
      action: "project.invite_rejected",
      detail: "Declined the invitation",
    });
  }

  return json({ ok: true, status: invite.status });
}
