import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Workspace, Project, Task, Sprint } from "@/models";
import { getWorkspaceRole, isWorkspaceManager, isSuperAdmin } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const role = await getWorkspaceRole(user, id);
  if (!role) return error("Workspace not found or access denied", 404);

  const workspace = await Workspace.findById(id)
    .populate("owner", "name email avatarColor")
    .populate("members.user", "name email avatarColor designation active");
  if (!workspace) return error("Workspace not found", 404);
  return json({ workspace, myRole: role });
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  // Plan fields — super-admin only (enforced below). Assigned from the admin panel.
  plan: z.enum(["trial", "pro", "business", "enterprise"]).optional(),
  subscriptionStatus: z.enum(["trialing", "active", "expired"]).optional(),
  planExpiresAt: z.string().datetime().nullable().optional(),
});

const PLAN_FIELDS = ["plan", "subscriptionStatus", "planExpiresAt"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const touchesPlan = PLAN_FIELDS.some((f) => f in data);
  const superAdmin = isSuperAdmin(user);

  // Plan fields can only be changed by the super admin (billing is centrally
  // controlled). Workspace owners/admins may edit name/description as before.
  if (touchesPlan && !superAdmin) {
    return error("Only the super admin can change a workspace's plan", 403);
  }
  if (!touchesPlan) {
    const role = await getWorkspaceRole(user, id);
    if (!isWorkspaceManager(role)) return error("Only workspace owners and admins can edit the workspace", 403);
  }

  const workspace = await Workspace.findByIdAndUpdate(id, { $set: data }, { new: true });
  if (!workspace) return error("Workspace not found", 404);

  const detail = touchesPlan && data.plan
    ? `Set plan to ${data.plan}${data.subscriptionStatus ? ` (${data.subscriptionStatus})` : ""}`
    : "Updated workspace settings";
  await logActivity({ workspace: id, user: String(user!._id), action: touchesPlan ? "workspace.plan_changed" : "workspace.updated", detail });
  return json({ workspace });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  if (String(workspace.owner) !== String(user!._id) && !isSuperAdmin(user)) {
    return error("Only the workspace owner can delete it", 403);
  }

  const projects = await Project.find({ workspace: id }).select("_id");
  const projectIds = projects.map((p) => p._id);
  await Task.deleteMany({ project: { $in: projectIds } });
  await Sprint.deleteMany({ project: { $in: projectIds } });
  await Project.deleteMany({ workspace: id });
  await Workspace.findByIdAndDelete(id);

  return json({ ok: true });
}
