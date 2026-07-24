import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Sprint } from "@/models";
import { getProjectRole, can } from "@/lib/permissions";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project");
  if (!projectId) return error("project query param is required");

  const role = await getProjectRole(user, projectId);
  if (!role) return error("Access denied", 403);

  const includeArchived = searchParams.get("archived") === "1";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { project: projectId };
  if (!includeArchived) filter.status = { $ne: "archived" };

  const sprints = await Sprint.find(filter).sort({ createdAt: 1 });
  return json({ sprints });
}

const createSchema = z.object({
  project: z.string(),
  name: z.string().min(1).max(80),
  goal: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  capacity: z.number().min(0).max(1000).optional(),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  if (!(await can(user, data.project, "sprint:manage"))) return error("You don't have permission to manage sprints", 403);

  const sprint = await Sprint.create({
    project: data.project,
    name: data.name,
    goal: data.goal || "",
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    capacity: data.capacity || 0,
  });

  await logActivity({
    project: data.project,
    sprint: String(sprint._id),
    user: String(user!._id),
    action: "sprint.created",
    detail: `Created sprint "${sprint.name}"`,
  });
  return json({ sprint }, 201);
}
