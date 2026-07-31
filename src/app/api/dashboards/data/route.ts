import { withAuth, json } from "@/lib/apiHelpers";
import { Task, Project, Sprint, Activity, Workspace, User } from "@/models";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/**
 * Aggregated data for all dashboard widgets in one call.
 *
 * Accepts optional filters as query params (all narrow the visible scope):
 *   projects=<id,id>   only these projects (subset of the ones the user can see)
 *   assignees=<id,id>  tasks assigned to these users; the literal `unassigned` matches null
 *   lead=<userId>      only projects whose `lead` is this user (owner/lead views)
 *   priority=<p,p>     task priority
 *   type=<t,t>         task type
 *   from,to=<ISO>      time window for the *time-series* widgets only
 *                      (growth / throughput / teamGrowth). Snapshot widgets
 *                      (byStatus, byAssignee, …) always reflect current state.
 */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;

  const sp = new URL(req.url).searchParams;
  const csv = (k: string) => (sp.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const projectsFilter = csv("projects");
  const assigneesFilter = csv("assignees");
  const priorityFilter = csv("priority");
  const typeFilter = csv("type");
  const leadFilter = sp.get("lead") || "";

  // time window for time-series widgets. Prefer the stable `range` token (so the
  // client's query string doesn't change every render); `from`/`to` override it.
  const RANGE_DAYS: Record<string, number> = { "30d": 30, "90d": 90, "6m": 183, "12m": 365 };
  const rangeDays = RANGE_DAYS[sp.get("range") || ""] || 90;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - rangeDays * 24 * 3600 * 1000);

  // projects visible to this user: every project in a workspace they belong to,
  // plus any project they guest on.
  const myWorkspaces = await Workspace.find({
    $or: [{ owner: user!._id }, { "members.user": user!._id }],
  }).select("_id");
  const projFilter = {
    $or: [
      { workspace: { $in: myWorkspaces.map((w) => w._id) } },
      { "members.user": user!._id },
    ],
  };
  // `allVisible` drives the filter-bar option lists (always the full scope so the
  // dropdowns never collapse); `projects` is the narrowed set the widgets read.
  const allVisible = await Project.find({ ...projFilter, archived: { $ne: true } })
    .select("_id name key statuses lead")
    .populate("lead", "name avatarColor");
  const leadId = (p: Any) => String(p.lead?._id ?? p.lead ?? "");

  let projects = allVisible;
  if (projectsFilter.length) projects = projects.filter((p) => projectsFilter.includes(String(p._id)));
  if (leadFilter) projects = projects.filter((p) => leadId(p) === leadFilter);

  const projectIds = projects.map((p) => p._id);

  // distinct assignees across the full visible scope → stable people options
  const allVisibleIds = allVisible.map((p) => p._id);
  const peopleIds = await Task.find({ project: { $in: allVisibleIds }, archived: false, assignee: { $ne: null } })
    .distinct("assignee");
  const peopleUsers = await User.find({ _id: { $in: peopleIds } }).select("name avatarColor");

  const doneIds = new Set<string>();
  for (const p of projects) {
    for (const s of p.statuses as Any[]) if (s.category === "done") doneIds.add(`${p._id}:${s.id}`);
  }
  const isDone = (t: { project: unknown; status: string }) => doneIds.has(`${t.project}:${t.status}`);

  // task-level filters applied to snapshot + time-series queries
  const taskFilters: Any = {};
  if (priorityFilter.length) taskFilters.priority = { $in: priorityFilter };
  if (typeFilter.length) taskFilters.type = { $in: typeFilter };
  if (assigneesFilter.length) {
    const ids = assigneesFilter.filter((a) => a !== "unassigned");
    const unassigned = assigneesFilter.includes("unassigned");
    if (ids.length && unassigned) taskFilters.$or = [{ assignee: { $in: ids } }, { assignee: null }];
    else if (ids.length) taskFilters.assignee = { $in: ids };
    else if (unassigned) taskFilters.assignee = null;
  }

  const base = { project: { $in: projectIds }, archived: false, ...taskFilters };
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
  const byAssignee: Record<string, { id: string; name: string; avatarColor: string; count: number; done: number }> = {};
  for (const t of allTasks) {
    const a: Any = t.assignee;
    const k = a ? String(a._id) : "unassigned";
    if (!byAssignee[k]) byAssignee[k] = { id: k, name: a?.name || "Unassigned", avatarColor: a?.avatarColor || "#94a3b8", count: 0, done: 0 };
    byAssignee[k].count++;
    if (isDone(t)) byAssignee[k].done++;
  }

  const open = allTasks.filter((t) => !isDone(t)).length;
  const closed = allTasks.length - open;

  /* ----------------------- time-series (growth) ----------------------- */
  // bucket the [from, to] window: daily for short ranges, weekly for long ones.
  const dayMs = 24 * 3600 * 1000;
  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / dayMs));
  const stepDays = spanDays <= 31 ? 1 : 7;
  const buckets: { label: string; start: number; end: number }[] = [];
  for (let t0 = from.getTime(); t0 <= to.getTime(); t0 += stepDays * dayMs) {
    const end = t0 + stepDays * dayMs;
    buckets.push({ label: new Date(t0).toISOString().slice(5, 10), start: t0, end });
  }

  const [createdInRange, completedInRange, createdBeforeFrom, completedBeforeFrom] = await Promise.all([
    Task.find({ ...base, createdAt: { $gte: from, $lte: to } }).select("createdAt"),
    Task.find({ ...base, completedAt: { $gte: from, $lte: to } }).select("completedAt assignee").populate("assignee", "name avatarColor"),
    Task.countDocuments({ ...base, createdAt: { $lt: from } }),
    Task.countDocuments({ ...base, completedAt: { $lt: from } }),
  ]);

  const openStart = Math.max(0, createdBeforeFrom - completedBeforeFrom);
  // people that completed work in range → team-growth series
  const growthPeople: Record<string, { name: string; color: string }> = {};
  for (const t of completedInRange) {
    const a: Any = t.assignee;
    if (a) growthPeople[String(a._id)] = { name: a.name, color: a.avatarColor || "#6366f1" };
  }
  const peopleNames = Object.values(growthPeople).map((p) => p.name);

  let runningOpen = openStart;
  const growth: Any[] = [];
  const throughput: Any[] = [];
  const teamGrowth: Any[] = [];
  for (const b of buckets) {
    const created = createdInRange.filter((t) => {
      const ts = new Date(t.createdAt).getTime();
      return ts >= b.start && ts < b.end;
    }).length;
    const doneInBucket = completedInRange.filter((t) => {
      const ts = new Date((t as Any).completedAt).getTime();
      return ts >= b.start && ts < b.end;
    });
    const completed = doneInBucket.length;
    runningOpen = Math.max(0, runningOpen + created - completed);
    growth.push({ label: b.label, created, completed, open: runningOpen });
    throughput.push({ label: b.label, completed });
    const row: Any = { label: b.label };
    for (const name of peopleNames) row[name] = 0;
    for (const t of doneInBucket) {
      const a: Any = (t as Any).assignee;
      if (a && a.name) row[a.name] = (row[a.name] || 0) + 1;
    }
    teamGrowth.push(row);
  }

  /* --------------------------- velocity trend ------------------------- */
  const doneSprints = await Sprint.find({ project: { $in: projectIds }, status: { $in: ["completed", "archived"] } })
    .sort({ completedAt: 1 })
    .limit(12);
  const velocity = doneSprints.map((s) => ({
    name: s.name,
    committed: s.committedPoints || 0,
    completed: s.completedPoints || 0,
  }));

  return json({
    assignedToMe,
    sprintProgress,
    byStatus: countBy("status"),
    byPriority: countBy("priority"),
    byAssignee: Object.values(byAssignee),
    openVsClosed: { open, closed },
    upcomingDeadlines: upcoming,
    recentActivity,
    growth,
    throughput,
    teamGrowth: { people: Object.values(growthPeople), rows: teamGrowth },
    velocity,
    range: { from, to, step: stepDays === 1 ? "day" : "week" },
    // filter-bar option lists — derived from the FULL visible scope so they
    // never collapse when a lead/assignee/project filter is applied.
    people: peopleUsers.map((u) => ({ id: String(u._id), name: u.name, color: (u as Any).avatarColor || "#94a3b8" })),
    leads: (() => {
      const m: Record<string, { id: string; name: string }> = {};
      for (const p of allVisible) {
        const l: Any = p.lead;
        if (l?._id) m[String(l._id)] = { id: String(l._id), name: l.name };
      }
      return Object.values(m);
    })(),
    projects: allVisible.map((p) => {
      const l: Any = p.lead;
      return { _id: p._id, name: p.name, key: p.key, statuses: p.statuses, lead: l?._id ? { _id: l._id, name: l.name } : null };
    }),
  });
}
