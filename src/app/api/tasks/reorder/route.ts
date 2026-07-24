import { z } from "zod";
import { withAuth, json, error, parseBody } from "@/lib/apiHelpers";
import { Task } from "@/models";
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

/** Persist drag & drop reordering (Kanban columns, backlog, sprint planning). */
export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  if (!(await can(user, data.project, "task:edit"))) return error("You don't have permission to reorder tasks", 403);

  const ops = data.updates.map((u) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: any = { order: u.order };
    if (u.status !== undefined) set.status = u.status;
    if (u.sprint !== undefined) set.sprint = u.sprint;
    return {
      updateOne: { filter: { _id: u.id, project: data.project }, update: { $set: set } },
    };
  });
  await Task.bulkWrite(ops);
  return json({ ok: true });
}
