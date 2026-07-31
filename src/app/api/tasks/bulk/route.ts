import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Task, Project } from "@/models";
import { can } from "@/lib/permissions";
import { PRIORITIES } from "@/lib/constants";

const schema = z.object({
  taskIds: z.array(z.string()).min(1).max(200),
  set: z.object({
    status: z.string().optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignee: z.string().nullable().optional(),
    sprint: z.string().nullable().optional(),
    storyPoints: z.number().min(0).max(100).nullable().optional(),
    archived: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
  }),
});

/** Bulk update a set of tasks (must all belong to projects the user can edit).
 *
 *  Status and sprint moves are applied per task — like the single-task PATCH and
 *  drag reorder — so completing tasks in bulk still stamps `completedAt`, logs a
 *  real per-task activity entry, and notifies watchers. (Plain field edits keep
 *  the fast single `updateMany` + one summary activity.) */
export async function PATCH(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  const tasks = await Task.find({ _id: { $in: data.taskIds } });
  const projectIds = [...new Set(tasks.map((t) => String(t.project)))];
  for (const pid of projectIds) {
    if (!(await can(user, pid, "task:edit"))) return error("You don't have permission on some of these tasks", 403);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: any = { ...data.set };
  if (set.dueDate !== undefined) set.dueDate = set.dueDate ? new Date(set.dueDate) : null;

  const changingStatus = set.status !== undefined;
  const changingSprint = set.sprint !== undefined;

  // Status/sprint changes are first-class task events → apply per task so we can
  // set done/started timestamps, log activity, and notify. Everything else stays
  // a single fast updateMany with one summary entry.
  if (changingStatus || changingSprint) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusesByProject: Record<string, any[]> = {};
    if (changingStatus) {
      const projects = await Project.find({ _id: { $in: projectIds } }).select("statuses");
      for (const p of projects) statusesByProject[String(p._id)] = p.statuses || [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = [];
    const logs: { task: typeof tasks[number]; detail: string; toName?: string }[] = [];

    for (const t of tasks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upd: any = { ...set };
      if (changingSprint) upd.sprint = set.sprint || null;

      if (changingStatus && set.status !== t.status) {
        const statuses = statusesByProject[String(t.project)] || [];
        const to = statuses.find((s) => s.id === set.status);
        if (to) {
          const from = statuses.find((s) => s.id === t.status)?.name || t.status;
          if (to.category === "done" && !t.completedAt) upd.completedAt = new Date();
          if (to.category !== "done") upd.completedAt = null;
          if (to.category === "in_progress" && !t.startedAt) upd.startedAt = new Date();
          logs.push({ task: t, detail: `status: ${from} → ${to.name}`, toName: to.name });
        }
      }
      if (changingSprint && String(set.sprint ?? "") !== String(t.sprint ?? "")) {
        logs.push({ task: t, detail: set.sprint ? "moved to sprint" : "moved to backlog" });
      }

      ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: upd } } });
    }

    await Task.bulkWrite(ops);

    for (const l of logs) {
      await logActivity({
        project: String(l.task.project), task: String(l.task._id), user: String(user!._id),
        action: "task.updated", detail: `${l.task.key}: ${l.detail}`,
      });
      if (l.toName) {
        for (const w of l.task.watchers || []) {
          await notify({
            user: String(w), type: "status_change", actor: String(user!._id),
            title: `${l.task.key} moved to ${l.toName}`,
            body: l.task.title, link: `/p/${l.task.project}/board?task=${l.task._id}`,
          });
        }
      }
    }
    return json({ ok: true, modified: ops.length });
  }

  const result = await Task.updateMany({ _id: { $in: data.taskIds } }, { $set: set });

  for (const pid of projectIds) {
    await logActivity({
      project: pid, user: String(user!._id),
      action: "task.bulk_updated",
      detail: `Bulk updated ${data.taskIds.length} task(s)`,
      meta: data.set,
    });
  }
  return json({ ok: true, modified: result.modifiedCount });
}
