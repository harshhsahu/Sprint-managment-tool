import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Project, Task, Sprint } from "@/models";
import { getProjectRole, getCapabilities, can } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const role = await getProjectRole(user, id);
  if (!role) return error("Project not found or access denied", 404);

  const project = await Project.findById(id)
    .populate("lead", "name email avatarColor")
    .populate("members.user", "name email avatarColor designation active")
    .populate({
      path: "workspace",
      select: "name owner members",
      populate: [
        { path: "owner", select: "name email avatarColor active" },
        { path: "members.user", select: "name email avatarColor designation active" },
      ],
    });
  if (!project) return error("Project not found", 404);
  const myCapabilities = [...(await getCapabilities(user, id))];
  return json({ project, myRole: role, myCapabilities });
}

const statusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  color: z.string().max(20),
  category: z.enum(["todo", "in_progress", "done"]),
  order: z.number(),
  wipLimit: z.number().min(0).max(100),
});

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(2000).optional(),
  lead: z.string().optional(),
  statuses: z.array(statusSchema).min(1).optional(),
  hiddenFields: z.array(z.string()).max(30).optional(),
  requiredFields: z.array(z.string()).max(30).optional(),
  customFields: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(40),
        type: z.enum(["text", "number", "date", "multiselect"]),
        options: z
          .array(z.object({ id: z.string().min(1), name: z.string().min(1).max(40), color: z.string().max(20) }))
          .max(100)
          .optional(),
      })
    )
    .max(20)
    .optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "project:manage"))) return error("You don't have permission to update project settings", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  // if statuses changed, remap tasks whose status was removed to the first status
  if (data.statuses) {
    const newIds = data.statuses.map((s) => s.id);
    await Task.updateMany(
      { project: id, status: { $nin: newIds } },
      { $set: { status: data.statuses[0].id } }
    );
  }

  const project = await Project.findByIdAndUpdate(id, { $set: data }, { new: true })
    .populate("lead", "name email avatarColor")
    .populate("members.user", "name email avatarColor designation active");
  if (!project) return error("Project not found", 404);

  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.updated",
    detail: "Updated project configuration",
    meta: Object.keys(data),
  });
  return json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "project:manage"))) return error("You don't have permission to delete the project", 403);

  await Task.deleteMany({ project: id });
  await Sprint.deleteMany({ project: id });
  const project = await Project.findByIdAndDelete(id);
  if (!project) return error("Project not found", 404);

  await logActivity({
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.deleted",
    detail: `Deleted project "${project.name}"`,
  });
  return json({ ok: true });
}
