import { withAuth, json } from "@/lib/apiHelpers";
import { Invite } from "@/models";

/** Pending invitations addressed to the signed-in user (matched by email). */
export async function GET() {
  const { user, res } = await withAuth();
  if (res) return res;

  const invites = await Invite.find({ email: user!.email, status: "pending" })
    .populate({ path: "project", select: "name key workspace" })
    .populate("invitedBy", "name email avatarColor")
    .sort({ createdAt: -1 });

  // A project could have been deleted after the invite was created — drop those.
  const valid = invites.filter((i) => i.project);
  return json({ invites: valid });
}
