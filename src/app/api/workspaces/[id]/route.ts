import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Workspace, Project, Task, Sprint } from "@/models";
import { getWorkspaceRole, isWorkspaceManager } from "@/lib/permissions";

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
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const role = await getWorkspaceRole(user, id);
  if (!isWorkspaceManager(role)) return error("Only workspace owners and admins can edit the workspace", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const workspace = await Workspace.findByIdAndUpdate(id, { $set: data }, { new: true });
  if (!workspace) return error("Workspace not found", 404);

  await logActivity({ workspace: id, user: String(user!._id), action: "workspace.updated", detail: `Updated workspace settings` });
  return json({ workspace });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const workspace = await Workspace.findById(id);
  if (!workspace) return error("Workspace not found", 404);
  if (String(workspace.owner) !== String(user!._id) && user!.role !== "super_admin") {
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
