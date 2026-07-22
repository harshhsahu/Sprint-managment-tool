import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Sprint, Task, Project } from "@/models";
import { getProjectRole, roleAtLeast } from "@/lib/permissions";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  goal: z.string().max(500).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  capacity: z.number().min(0).max(1000).optional(),
  action: z.enum(["start", "complete", "archive"]).optional(),
  moveIncompleteTo: z.string().nullable().optional(), // sprint id or null = backlog (used with complete)
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const sprint = await Sprint.findById(id);
  if (!sprint) return error("Sprint not found", 404);

  const role = await getProjectRole(user, String(sprint.project));
  if (!roleAtLeast(role, "team_lead")) return error("Only team leads and above can manage sprints", 403);

  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const project = await Project.findById(sprint.project).select("statuses name members");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doneStatuses = (project?.statuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id);

  if (data.action === "start") {
    if (sprint.status !== "planned") return error("Only a planned sprint can be started", 400);
    const active = await Sprint.findOne({ project: sprint.project, status: "active" });
    if (active) return error(`Sprint "${active.name}" is already active. Complete it first.`, 409);
    sprint.status = "active";
    if (!sprint.startDate) sprint.startDate = new Date();
    if (!sprint.endDate) sprint.endDate = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const tasks = await Task.find({ sprint: id, archived: false });
    sprint.committedPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    await sprint.save();
    await logActivity({
      project: String(sprint.project), sprint: id, user: String(user!._id),
      action: "sprint.started", detail: `Started sprint "${sprint.name}"`,
    });
    // notify project members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (project?.members || []) as any[]) {
      await notify({
        user: String(m.user), type: "sprint", actor: String(user!._id),
        title: `Sprint "${sprint.name}" started in ${project?.name}`,
        link: `/p/${sprint.project}/board`,
      });
    }
    return json({ sprint });
  }

  if (data.action === "complete") {
    if (sprint.status !== "active") return error("Only an active sprint can be completed", 400);
    const tasks = await Task.find({ sprint: id, archived: false });
    const done = tasks.filter((t) => doneStatuses.includes(t.status));
    const notDone = tasks.filter((t) => !doneStatuses.includes(t.status));
    sprint.completedPoints = done.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    sprint.status = "completed";
    sprint.completedAt = new Date();
    await sprint.save();
    // move incomplete tasks to target sprint or backlog
    await Task.updateMany(
      { _id: { $in: notDone.map((t) => t._id) } },
      { $set: { sprint: data.moveIncompleteTo || null } }
    );
    await logActivity({
      project: String(sprint.project), sprint: id, user: String(user!._id),
      action: "sprint.completed",
      detail: `Completed sprint "${sprint.name}" — ${done.length} done, ${notDone.length} moved`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (project?.members || []) as any[]) {
      await notify({
        user: String(m.user), type: "sprint", actor: String(user!._id),
        title: `Sprint "${sprint.name}" completed in ${project?.name}`,
        link: `/p/${sprint.project}/reports`,
      });
    }
    return json({ sprint });
  }

  if (data.action === "archive") {
    sprint.status = "archived";
    await sprint.save();
    await logActivity({
      project: String(sprint.project), sprint: id, user: String(user!._id),
      action: "sprint.archived", detail: `Archived sprint "${sprint.name}"`,
    });
    return json({ sprint });
  }

  // plain field updates
  if (data.name !== undefined) sprint.name = data.name;
  if (data.goal !== undefined) sprint.goal = data.goal;
  if (data.capacity !== undefined) sprint.capacity = data.capacity;
  if (data.startDate !== undefined) sprint.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) sprint.endDate = data.endDate ? new Date(data.endDate) : null;
  await sprint.save();

  await logActivity({
    project: String(sprint.project), sprint: id, user: String(user!._id),
    action: "sprint.updated", detail: `Updated sprint "${sprint.name}"`,
  });
  return json({ sprint });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const sprint = await Sprint.findById(id);
  if (!sprint) return error("Sprint not found", 404);

  const role = await getProjectRole(user, String(sprint.project));
  if (!roleAtLeast(role, "team_lead")) return error("Only team leads and above can delete sprints", 403);
  if (sprint.status === "active") return error("Cannot delete an active sprint. Complete it first.", 400);

  await Task.updateMany({ sprint: id }, { $set: { sprint: null } });
  await Sprint.findByIdAndDelete(id);

  await logActivity({
    project: String(sprint.project), user: String(user!._id),
    action: "sprint.deleted", detail: `Deleted sprint "${sprint.name}"`,
  });
  return json({ ok: true });
}
