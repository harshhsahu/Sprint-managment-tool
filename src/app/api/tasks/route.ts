import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Task, Project, Workspace } from "@/models";
import { getProjectRole, can } from "@/lib/permissions";
import { TASK_TYPES, PRIORITIES } from "@/lib/constants";

/** List tasks with rich filtering, sorting and pagination.
    ?project= &sprint=(id|none|active) &status= &priority= &assignee=(id|me|none) &reporter=
    &type= &label= &epic= &q= &dueBefore= &dueAfter= &points= &archived=1
    &sort=order|-createdAt|dueDate|priority &page=1 &limit=50 */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const sp = new URL(req.url).searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { archived: sp.get("archived") === "1" };

  const projectId = sp.get("project");
  if (projectId) {
    const role = await getProjectRole(user, projectId);
    if (!role) return error("Access denied", 403);
    filter.project = projectId;
  } else {
    // cross-project queries (my tasks) limited to projects the user can see:
    // every project in a workspace they belong to, plus any project they guest on.
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: user!._id }, { "members.user": user!._id }],
    }).select("_id");
    const projects = await Project.find({
      $or: [
        { workspace: { $in: myWorkspaces.map((w) => w._id) } },
        { "members.user": user!._id },
      ],
    }).select("_id");
    filter.project = { $in: projects.map((p) => p._id) };
  }

  const csv = (v: string | null) => (v ? v.split(",").filter(Boolean) : null);

  const status = csv(sp.get("status"));
  if (status) filter.status = { $in: status };
  const priority = csv(sp.get("priority"));
  if (priority) filter.priority = { $in: priority };
  const type = csv(sp.get("type"));
  if (type) filter.type = { $in: type };
  const label = csv(sp.get("label"));
  if (label) filter.labels = { $in: label };

  const assignee = sp.get("assignee");
  if (assignee === "me") filter.assignee = user!._id;
  else if (assignee === "none") filter.assignee = null;
  else if (assignee) filter.assignee = { $in: assignee.split(",") };

  const reporter = sp.get("reporter");
  if (reporter === "me") filter.reporter = user!._id;
  else if (reporter) filter.reporter = { $in: reporter.split(",") };

  const sprint = sp.get("sprint");
  if (sprint === "none") filter.sprint = null;
  else if (sprint) filter.sprint = { $in: sprint.split(",") };

  const epic = sp.get("epic");
  if (epic) filter.epic = epic;
  const parentTask = sp.get("parentTask");
  if (parentTask) filter.parentTask = parentTask;

  const q = sp.get("q");
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { key: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const dueBefore = sp.get("dueBefore");
  const dueAfter = sp.get("dueAfter");
  if (dueBefore || dueAfter) {
    filter.dueDate = {};
    if (dueBefore) filter.dueDate.$lte = new Date(dueBefore);
    if (dueAfter) filter.dueDate.$gte = new Date(dueAfter);
  }
  const points = sp.get("points");
  if (points) filter.storyPoints = { $in: points.split(",").map(Number) };

  const sortParam = sp.get("sort") || "order";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 100));

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate("assignee", "name email avatarColor")
      .populate("reporter", "name email avatarColor")
      .populate("sprint", "name status")
      .populate("epic", "title key")
      .sort(sortParam)
      .skip((page - 1) * limit)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  return json({ tasks, total, page, pages: Math.ceil(total / limit) });
}

const createSchema = z.object({
  project: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().max(50000).optional(),
  type: z.enum(TASK_TYPES).default("task"),
  status: z.string().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  assignee: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  epic: z.string().nullable().optional(),
  parentTask: z.string().nullable().optional(),
  storyPoints: z.number().min(0).max(100).nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  if (!(await can(user, data.project, "task:create"))) return error("You don't have permission to create tasks", 403);

  const project = await Project.findByIdAndUpdate(
    data.project,
    { $inc: { taskCounter: 1 } },
    { new: true }
  );
  if (!project) return error("Project not found", 404);

  const defaultStatus = data.status || project.statuses[0]?.id || "backlog";
  const maxOrder = await Task.findOne({ project: data.project, status: defaultStatus })
    .sort("-order")
    .select("order");

  const task = await Task.create({
    project: data.project,
    key: `${project.key}-${project.taskCounter}`,
    title: data.title,
    description: data.description || "",
    type: data.type,
    status: defaultStatus,
    priority: data.priority,
    assignee: data.assignee || null,
    reporter: user!._id,
    sprint: data.sprint || null,
    epic: data.epic || null,
    parentTask: data.parentTask || null,
    storyPoints: data.storyPoints ?? null,
    labels: data.labels || [],
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    customFields: data.customFields || {},
    watchers: [user!._id],
    order: (maxOrder?.order ?? 0) + 1000,
  });

  await logActivity({
    project: data.project, task: String(task._id), user: String(user!._id),
    action: "task.created", detail: `Created ${task.type} ${task.key}: "${task.title}"`,
  });
  if (data.assignee) {
    await notify({
      user: data.assignee, type: "assignment", actor: String(user!._id),
      title: `${user!.name} assigned ${task.key} to you`,
      body: task.title, link: `/p/${data.project}/board?task=${task._id}`,
    });
  }

  const populated = await Task.findById(task._id)
    .populate("assignee", "name email avatarColor")
    .populate("reporter", "name email avatarColor");
  return json({ task: populated }, 201);
}
