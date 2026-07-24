import { withAuth, json } from "@/lib/apiHelpers";
import { Task, Project, Sprint, Activity, Workspace } from "@/models";

/** Aggregated data for all dashboard widgets in one call. */
export async function GET() {
  const { user, res } = await withAuth();
  if (res) return res;

  // projects visible to this user (strict isolation): member/lead, or in a workspace they admin
  const myWorkspaces = await Workspace.find({
    $or: [{ owner: user!._id }, { "members.user": user!._id, "members.role": "workspace_admin" }],
  }).select("_id");
  const projFilter = {
    $or: [
      { "members.user": user!._id },
      { lead: user!._id },
      { workspace: { $in: myWorkspaces.map((w) => w._id) } },
    ],
  };
  const projects = await Project.find({ ...projFilter, archived: { $ne: true } }).select("_id name key statuses");
  const projectIds = projects.map((p) => p._id);

  const doneIds = new Set<string>();
  for (const p of projects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of p.statuses as any[]) if (s.category === "done") doneIds.add(`${p._id}:${s.id}`);
  }
  const isDone = (t: { project: unknown; status: string }) => doneIds.has(`${t.project}:${t.status}`);

  const base = { project: { $in: projectIds }, archived: false };
  const in14days = new Date(Date.now() + 14 * 24 * 3600 * 1000);

  const [assignedToMe, allTasks, activeSprints, recentActivity, upcoming] = await Promise.all([
    Task.find({ ...base, assignee: user!._id })
      .populate("sprint", "name")
      .select("title key type status priority project dueDate storyPoints")
      .sort("-updatedAt")
      .limit(30),
    Task.find(base).select("status priority assignee project storyPoints completedAt createdAt").populate("assignee", "name avatarColor"),
    Sprint.find({ project: { $in: projectIds }, status: "active" }),
    Activity.find({ project: { $in: projectIds } })
      .populate("user", "name avatarColor")
      .populate("task", "key title")
      .populate("project", "name key")
      .sort({ createdAt: -1 })
      .limit(15),
    Task.find({ ...base, dueDate: { $ne: null, $lte: in14days } })
      .populate("assignee", "name avatarColor")
      .select("title key type status priority project dueDate assignee")
      .sort("dueDate")
      .limit(20),
  ]);

  // sprint progress per active sprint
  const sprintProgress = [];
  for (const s of activeSprints) {
    const tasks = await Task.find({ sprint: s._id, archived: false }).select("status project storyPoints");
    const total = tasks.length;
    const done = tasks.filter(isDone).length;
    const totalPts = tasks.reduce((a, t) => a + (t.storyPoints || 0), 0);
    const donePts = tasks.filter(isDone).reduce((a, t) => a + (t.storyPoints || 0), 0);
    const project = projects.find((p) => String(p._id) === String(s.project));
    sprintProgress.push({
      sprint: { _id: s._id, name: s.name, endDate: s.endDate, project: s.project },
      projectName: project?.name || "",
      total, done, totalPts, donePts,
    });
  }

  const countBy = (key: "status" | "priority") => {
    const map: Record<string, number> = {};
    for (const t of allTasks) {
      const k = String(t[key] ?? "none");
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  };
  const byAssignee: Record<string, { name: string; avatarColor: string; count: number; done: number }> = {};
  for (const t of allTasks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a: any = t.assignee;
    const k = a ? String(a._id) : "unassigned";
    if (!byAssignee[k]) byAssignee[k] = { name: a?.name || "Unassigned", avatarColor: a?.avatarColor || "#94a3b8", count: 0, done: 0 };
    byAssignee[k].count++;
    if (isDone(t)) byAssignee[k].done++;
  }

  const open = allTasks.filter((t) => !isDone(t)).length;
  const closed = allTasks.length - open;

  return json({
    assignedToMe,
    sprintProgress,
    byStatus: countBy("status"),
    byPriority: countBy("priority"),
    byAssignee: Object.values(byAssignee),
    openVsClosed: { open, closed },
    upcomingDeadlines: upcoming,
    recentActivity,
    projects: projects.map((p) => ({ _id: p._id, name: p.name, key: p.key, statuses: p.statuses })),
  });
}
