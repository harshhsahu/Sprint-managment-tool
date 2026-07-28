import { withAuth, json, error, logActivity } from "@/lib/apiHelpers";
import { Task, Project } from "@/models";
import { can } from "@/lib/permissions";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const src = await Task.findById(id);
  if (!src) return error("Task not found", 404);

  if (!(await can(user, String(src.project), "task:create"))) return error("You don't have permission to duplicate tasks", 403);

  const project = await Project.findByIdAndUpdate(src.project, { $inc: { taskCounter: 1 } }, { new: true });
  if (!project) return error("Project not found", 404);

  const copy = await Task.create({
    project: src.project,
    key: `${project.key}-${project.taskCounter}`,
    title: `${src.title} (copy)`,
    description: src.description,
    type: src.type,
    status: src.status,
    priority: src.priority,
    assignee: src.assignee,
    reporter: user!._id,
    sprint: src.sprint,
    epic: src.epic,
    storyPoints: src.storyPoints,
    customFields: src.customFields,
    dueDate: src.dueDate,
    watchers: [user!._id],
    order: src.order + 1,
  });

  await logActivity({
    project: String(src.project), task: String(copy._id), user: String(user!._id),
    action: "task.duplicated", detail: `Duplicated ${src.key} as ${copy.key}`,
  });

  const populated = await Task.findById(copy._id)
    .populate("assignee", "name email avatarColor")
    .populate("reporter", "name email avatarColor");
  return json({ task: populated }, 201);
}
