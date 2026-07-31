import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Task, Project } from "@/models";
import { can } from "@/lib/permissions";

const schema = z.object({
  project: z.string(),
  // ordered list of task ids with their (possibly new) status/sprint
  updates: z
    .array(
      z.object({
        id: z.string(),
        order: z.number(),
        status: z.string().optional(),
        sprint: z.string().nullable().optional(),
      })
    )
    .min(1)
    .max(500),
});

/** Persist drag & drop reordering (Kanban columns, backlog, sprint planning).
 *
 *  Drag & drop is a first-class task change, not just a cosmetic reorder: moving
 *  a card across columns changes its status (and may complete it), and moving a
 *  row between backlog/sprint changes membership. So — like the single-task
 *  PATCH — this route sets done/started timestamps, logs activity, and notifies
 *  watchers on those changes. (It used to only `$set` the raw fields, which is
 *  why board-completed tasks never got a `completedAt` or an activity entry.) */
export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  if (!(await can(user, data.project, "task:edit"))) return error("You don't have permission to reorder tasks", 403);

  // Load current state only for updates that actually change status/sprint, so
  // we can diff against it (pure reorders stay a cheap bulkWrite with no reads).
  const changingIds = data.updates.filter((u) => u.status !== undefined || u.sprint !== undefined).map((u) => u.id);
  const current = changingIds.length
    ? await Task.find({ _id: { $in: changingIds }, project: data.project })
    : [];
  const byId = new Map(current.map((t) => [String(t._id), t]));
  const needStatuses = data.updates.some((u) => u.status !== undefined);
  const project = needStatuses ? await Project.findById(data.project).select("statuses") : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statuses: any[] = project?.statuses || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];
  // Side-effects (activity + notifications) are collected and flushed after the
  // write so a logging hiccup can't leave the reorder half-applied.
  const logs: { taskId: string; detail: string; toName?: string; task: typeof current[number] }[] = [];

  for (const u of data.updates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: any = { order: u.order };
    const task = byId.get(u.id);

    if (u.status !== undefined) {
      set.status = u.status;
      if (task && u.status !== task.status) {
        const from = statuses.find((s) => s.id === task.status)?.name || task.status;
        const to = statuses.find((s) => s.id === u.status);
        if (to) {
          if (to.category === "done" && !task.completedAt) set.completedAt = new Date();
          if (to.category !== "done") set.completedAt = null;
          if (to.category === "in_progress" && !task.startedAt) set.startedAt = new Date();
          logs.push({ taskId: u.id, task, detail: `status: ${from} → ${to.name}`, toName: to.name });
        }
      }
    }

    if (u.sprint !== undefined) {
      set.sprint = u.sprint;
      if (task && String(u.sprint ?? "") !== String(task.sprint ?? "")) {
        logs.push({ taskId: u.id, task, detail: u.sprint ? "moved to sprint" : "moved to backlog" });
      }
    }

    ops.push({ updateOne: { filter: { _id: u.id, project: data.project }, update: { $set: set } } });
  }

  await Task.bulkWrite(ops);

  for (const l of logs) {
    await logActivity({
      project: data.project, task: l.taskId, user: String(user!._id),
      action: "task.updated", detail: `${l.task.key}: ${l.detail}`,
    });
    // notify watchers on a status change, matching the single-task PATCH.
    if (l.toName) {
      for (const w of l.task.watchers || []) {
        await notify({
          user: String(w), type: "status_change", actor: String(user!._id),
          title: `${l.task.key} moved to ${l.toName}`,
          body: l.task.title, link: `/p/${data.project}/board?task=${l.task._id}`,
        });
      }
    }
  }

  return json({ ok: true });
}
