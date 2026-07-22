import { withAuth, json, error } from "@/lib/apiHelpers";
import { Task, Sprint, Project } from "@/models";
import { getProjectRole } from "@/lib/permissions";

/** Agile reports for a project.
    ?type=velocity|burndown|distribution|flow|aging  (&sprint=<id> for burndown) */
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { projectId } = await params;

  const role = await getProjectRole(user, projectId);
  if (!role) return error("Access denied", 403);

  const project = await Project.findById(projectId).select("statuses name key");
  if (!project) return error("Project not found", 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statuses: any[] = project.statuses;
  const doneIds = statuses.filter((s) => s.category === "done").map((s) => s.id);

  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") || "velocity";

  if (type === "velocity") {
    const sprints = await Sprint.find({ project: projectId, status: { $in: ["completed", "archived"] } })
      .sort({ completedAt: 1 })
      .limit(12);
    return json({
      velocity: sprints.map((s) => ({
        name: s.name,
        committed: s.committedPoints || 0,
        completed: s.completedPoints || 0,
      })),
    });
  }

  if (type === "burndown") {
    const sprintId = sp.get("sprint");
    const sprint = sprintId
      ? await Sprint.findById(sprintId)
      : await Sprint.findOne({ project: projectId, status: "active" });
    if (!sprint || !sprint.startDate) return json({ burndown: [], sprint: null });

    const tasks = await Task.find({ sprint: sprint._id }).select("storyPoints completedAt createdAt status");
    const totalPts = tasks.reduce((a, t) => a + (t.storyPoints || 0), 0);
    const start = new Date(sprint.startDate);
    const end = sprint.endDate ? new Date(sprint.endDate) : new Date();
    const days: { date: string; remaining: number; ideal: number }[] = [];
    const dayMs = 24 * 3600 * 1000;
    const nDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));
    const today = new Date();

    for (let i = 0; i <= nDays; i++) {
      const d = new Date(start.getTime() + i * dayMs);
      const donePts = tasks
        .filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(d.getTime() + dayMs - 1))
        .reduce((a, t) => a + (t.storyPoints || 0), 0);
      days.push({
        date: d.toISOString().slice(5, 10),
        remaining: d <= today ? totalPts - donePts : NaN,
        ideal: Math.max(0, Math.round((totalPts - (totalPts / nDays) * i) * 10) / 10),
      });
    }
    // burnup data comes free
    const burnup = days.map((d, i) => {
      const dd = new Date(start.getTime() + i * dayMs);
      const donePts = tasks
        .filter((t) => t.completedAt && new Date(t.completedAt) <= new Date(dd.getTime() + dayMs - 1))
        .reduce((a, t) => a + (t.storyPoints || 0), 0);
      return { date: d.date, completed: dd <= today ? donePts : NaN, scope: totalPts };
    });
    return json({
      burndown: days.map((d) => ({ ...d, remaining: Number.isNaN(d.remaining) ? null : d.remaining })),
      burnup: burnup.map((d) => ({ ...d, completed: Number.isNaN(d.completed) ? null : d.completed })),
      sprint: { _id: sprint._id, name: sprint.name, totalPts },
    });
  }

  if (type === "distribution") {
    const tasks = await Task.find({ project: projectId, archived: false }).select("status priority type assignee storyPoints").populate("assignee", "name");
    const count = (fn: (t: { status: string; priority: string; type: string }) => string) => {
      const m: Record<string, number> = {};
      for (const t of tasks) m[fn(t)] = (m[fn(t)] || 0) + 1;
      return Object.entries(m).map(([name, value]) => ({ name, value }));
    };
    return json({
      byStatus: count((t) => statuses.find((s) => s.id === t.status)?.name || t.status),
      byPriority: count((t) => t.priority),
      byType: count((t) => t.type),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      byAssignee: count((t: any) => t.assignee?.name || "Unassigned"),
      statuses,
    });
  }

  if (type === "flow") {
    // cycle time (started->done) & lead time (created->done) for last 50 completed
    const done = await Task.find({ project: projectId, completedAt: { $ne: null } })
      .sort({ completedAt: -1 })
      .limit(100)
      .select("key title createdAt startedAt completedAt");
    const dayMs = 24 * 3600 * 1000;
    const items = done.map((t) => ({
      key: t.key,
      leadDays: Math.round(((+new Date(t.completedAt) - +new Date(t.createdAt)) / dayMs) * 10) / 10,
      cycleDays: t.startedAt
        ? Math.round(((+new Date(t.completedAt) - +new Date(t.startedAt)) / dayMs) * 10) / 10
        : null,
      completedAt: t.completedAt,
    }));
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
    // throughput per week (last 8 weeks)
    const throughput: { week: string; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const end = new Date(Date.now() - w * 7 * dayMs);
      const start = new Date(end.getTime() - 7 * dayMs);
      throughput.push({
        week: `${start.getMonth() + 1}/${start.getDate()}`,
        count: items.filter((i) => new Date(i.completedAt) > start && new Date(i.completedAt) <= end).length,
      });
    }
    // cumulative flow: tasks per status category over last 30 days (approximation from current data)
    const all = await Task.find({ project: projectId, archived: false }).select("status createdAt completedAt startedAt");
    const cfd: { date: string; todo: number; in_progress: number; done: number }[] = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(Date.now() - d * dayMs);
      let todo = 0, inprog = 0, doneN = 0;
      for (const t of all) {
        if (new Date(t.createdAt) > day) continue;
        if (t.completedAt && new Date(t.completedAt) <= day) doneN++;
        else if (t.startedAt && new Date(t.startedAt) <= day) inprog++;
        else todo++;
      }
      cfd.push({ date: day.toISOString().slice(5, 10), todo, in_progress: inprog, done: doneN });
    }
    return json({
      avgLeadDays: avg(items.map((i) => i.leadDays)),
      avgCycleDays: avg(items.filter((i) => i.cycleDays != null).map((i) => i.cycleDays as number)),
      throughput,
      cfd,
      recent: items.slice(0, 20),
    });
  }

  if (type === "aging") {
    const open = await Task.find({ project: projectId, archived: false, status: { $nin: doneIds } })
      .populate("assignee", "name avatarColor")
      .select("key title status priority assignee createdAt updatedAt dependencies")
      .sort("createdAt")
      .limit(200);
    const dayMs = 24 * 3600 * 1000;
    const aging = open.map((t) => ({
      _id: t._id,
      key: t.key,
      title: t.title,
      status: statuses.find((s) => s.id === t.status)?.name || t.status,
      priority: t.priority,
      assignee: t.assignee,
      ageDays: Math.round((Date.now() - +new Date(t.createdAt)) / dayMs),
      blocked: (t.dependencies?.length || 0) > 0,
    }));
    return json({ aging: aging.sort((a, b) => b.ageDays - a.ageDays).slice(0, 30), blocked: aging.filter((a) => a.blocked) });
  }

  return error("Unknown report type", 400);
}
