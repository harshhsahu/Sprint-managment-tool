import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Task, Comment, Activity, Project } from "@/models";
import { getProjectRole, roleAtLeast } from "@/lib/permissions";
import { TASK_TYPES, PRIORITIES } from "@/lib/constants";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const task = await Task.findById(id)
    .populate("assignee", "name email avatarColor designation")
    .populate("reporter", "name email avatarColor designation")
    .populate("sprint", "name status")
    .populate("epic", "title key type")
    .populate("parentTask", "title key type")
    .populate("watchers", "name email avatarColor")
    .populate("dependencies", "title key status type");
  if (!task) return error("Task not found", 404);

  const role = await getProjectRole(user, String(task.project));
  if (!role) return error("Access denied", 403);

  const [comments, activity, subtasks] = await Promise.all([
    Comment.find({ task: id }).populate("author", "name email avatarColor").sort({ createdAt: 1 }),
    Activity.find({ task: id }).populate("user", "name email avatarColor").sort({ createdAt: -1 }).limit(50),
    Task.find({ parentTask: id, archived: false })
      .populate("assignee", "name email avatarColor")
      .sort("order"),
  ]);

  return json({ task, comments, activity, subtasks, myRole: role });
}

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(50000).optional(),
  type: z.enum(TASK_TYPES).optional(),
  status: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  epic: z.string().nullable().optional(),
  storyPoints: z.number().min(0).max(100).nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  watchers: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  order: z.number().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const task = await Task.findById(id);
  if (!task) return error("Task not found", 404);

  const role = await getProjectRole(user, String(task.project));
  if (!roleAtLeast(role, "developer")) return error("You don't have permission to edit tasks", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const changes: string[] = [];
  const project = await Project.findById(task.project).select("statuses key name");

  if (data.status !== undefined && data.status !== task.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statuses: any[] = project?.statuses || [];
    const from = statuses.find((s) => s.id === task.status)?.name || task.status;
    const toStatus = statuses.find((s) => s.id === data.status);
    if (!toStatus) return error("Invalid status for this project", 422);
    changes.push(`status: ${from} → ${toStatus.name}`);
    if (toStatus.category === "done" && !task.completedAt) task.completedAt = new Date();
    if (toStatus.category !== "done") task.completedAt = null;
    if (toStatus.category === "in_progress" && !task.startedAt) task.startedAt = new Date();
    task.status = data.status;
    // notify watchers of status change
    for (const w of task.watchers || []) {
      await notify({
        user: String(w), type: "status_change", actor: String(user!._id),
        title: `${task.key} moved to ${toStatus.name}`,
        body: task.title, link: `/p/${task.project}/board?task=${task._id}`,
      });
    }
  }

  if (data.assignee !== undefined && String(data.assignee) !== String(task.assignee ?? "")) {
    changes.push("assignee changed");
    task.assignee = data.assignee || null;
    if (data.assignee) {
      await notify({
        user: data.assignee, type: "assignment", actor: String(user!._id),
        title: `${user!.name} assigned ${task.key} to you`,
        body: task.title, link: `/p/${task.project}/board?task=${task._id}`,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!task.watchers.some((w: any) => String(w) === data.assignee)) task.watchers.push(data.assignee);
    }
  }

  const simpleFields = ["title", "description", "type", "priority", "storyPoints", "labels", "watchers", "dependencies", "archived", "order"] as const;
  for (const f of simpleFields) {
    if (data[f] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task as any)[f] = data[f];
      if (!["order", "watchers"].includes(f)) changes.push(`${f} updated`);
    }
  }
  if (data.sprint !== undefined) {
    task.sprint = data.sprint || null;
    changes.push(data.sprint ? "moved to sprint" : "moved to backlog");
  }
  if (data.epic !== undefined) {
    task.epic = data.epic || null;
    changes.push("epic changed");
  }
  if (data.dueDate !== undefined) {
    task.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    changes.push("due date updated");
  }

  await task.save();

  if (changes.length) {
    await logActivity({
      project: String(task.project), task: id, user: String(user!._id),
      action: "task.updated", detail: `${task.key}: ${changes.join(", ")}`,
    });
  }

  const populated = await Task.findById(id)
    .populate("assignee", "name email avatarColor")
    .populate("reporter", "name email avatarColor")
    .populate("sprint", "name status")
    .populate("epic", "title key");
  return json({ task: populated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const task = await Task.findById(id);
  if (!task) return error("Task not found", 404);

  const role = await getProjectRole(user, String(task.project));
  if (!roleAtLeast(role, "team_lead")) return error("Only team leads and above can delete tasks", 403);

  await Task.deleteMany({ parentTask: id });
  await Comment.deleteMany({ task: id });
  await Task.updateMany({ dependencies: id }, { $pull: { dependencies: id } });
  await Task.findByIdAndDelete(id);

  await logActivity({
    project: String(task.project), user: String(user!._id),
    action: "task.deleted", detail: `Deleted ${task.key}: "${task.title}"`,
  });
  return json({ ok: true });
}
