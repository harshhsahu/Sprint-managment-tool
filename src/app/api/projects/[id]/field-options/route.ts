import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Project } from "@/models";
import { can } from "@/lib/permissions";

const schema = z.object({
  fieldId: z.string().min(1),
  name: z.string().min(1).max(40),
  color: z.string().max(20).optional(),
});

/** Add an option to a project's "multiselect" custom field inline. Allowed for
    anyone who can edit tasks (full field management — rename/recolor/delete —
    stays in project settings, admin only). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  if (!(await can(user, id, "task:edit"))) return error("You don't have permission to add options", 403);

  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(id);
  if (!project) return error("Project not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const field: any = (project.customFields || []).find((f: any) => f.id === data.fieldId);
  if (!field || field.type !== "multiselect") return error("Multiselect field not found", 404);

  field.options = field.options || [];
  const optId = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `opt-${field.options.length + 1}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (field.options.some((o: any) => o.id === optId)) return error("An option with a similar name already exists", 409);

  const option = { id: optId, name: data.name, color: data.color || "#3b82f6" };
  field.options.push(option);
  project.markModified("customFields");
  await project.save();

  await logActivity({
    project: id,
    workspace: String(project.workspace),
    user: String(user!._id),
    action: "project.field_option_added",
    detail: `Added option "${data.name}" to "${field.name}"`,
  });
  return json({ option, field, customFields: project.customFields }, 201);
}
