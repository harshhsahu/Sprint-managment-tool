import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Project } from "@/models";
import { can } from "@/lib/permissions";

const schema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().max(20).optional(),
});

/** Add a label to a project inline. Allowed for anyone who can edit tasks
    (full label management — rename/recolor/delete — stays in project settings). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "task:edit"))) return error("You don't have permission to add labels", 403);

  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);

  const labelId = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `lbl-${project.labels.length + 1}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (project.labels.some((l: any) => l.id === labelId)) return error("A label with a similar name already exists", 409);

  const label = { id: labelId, name: data.name, color: data.color || "#3b82f6" };
  project.labels.push(label);
  await project.save();

  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.label_added",
    detail: `Added label "${data.name}"`,
  });
  return json({ label, labels: project.labels }, 201);
}
