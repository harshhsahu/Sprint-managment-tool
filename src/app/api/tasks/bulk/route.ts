import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Task } from "@/models";
import { can } from "@/lib/permissions";
import { PRIORITIES } from "@/lib/constants";

const schema = z.object({
  taskIds: z.array(z.string()).min(1).max(200),
  set: z.object({
    status: z.string().optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignee: z.string().nullable().optional(),
    sprint: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    storyPoints: z.number().min(0).max(100).nullable().optional(),
    archived: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
  }),
});

/** Bulk update a set of tasks (must all belong to projects the user can edit). */
export async function PATCH(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  const tasks = await Task.find({ _id: { $in: data.taskIds } }).select("project");
  const projectIds = [...new Set(tasks.map((t) => String(t.project)))];
  for (const pid of projectIds) {
    if (!(await can(user, pid, "task:edit"))) return error("You don't have permission on some of these tasks", 403);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: any = { ...data.set };
  if (set.dueDate !== undefined) set.dueDate = set.dueDate ? new Date(set.dueDate) : null;

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
