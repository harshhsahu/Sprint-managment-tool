import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Project, Workspace } from "@/models";
import { getWorkspaceRole } from "@/lib/permissions";
import { DEFAULT_STATUSES } from "@/lib/constants";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { archived: { $ne: true } };
  if (workspaceId) {
    const role = await getWorkspaceRole(user, workspaceId);
    if (!role) return error("Access denied", 403);
    filter.workspace = workspaceId;
    // non-admin workspace members only see projects they belong to
    if (role !== "workspace_admin") {
      filter.$or = [{ "members.user": user!._id }, { lead: user!._id }];
    }
  } else {
    // strict isolation: only projects the user belongs to, or in workspaces they admin
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: user!._id }, { "members.user": user!._id, "members.role": "workspace_admin" }],
    }).select("_id");
    filter.$or = [
      { "members.user": user!._id },
      { lead: user!._id },
      { workspace: { $in: myWorkspaces.map((w) => w._id) } },
    ];
  }

  const projects = await Project.find(filter)
    .populate("lead", "name email avatarColor")
    .populate("members.user", "name email avatarColor")
    .populate("workspace", "name")
    .sort({ createdAt: 1 });
  return json({ projects });
}

const createSchema = z.object({
  workspace: z.string(),
  name: z.string().min(2).max(80),
  key: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Key must be letters/numbers, starting with a letter"),
  description: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  const wsRole = await getWorkspaceRole(user, data.workspace);
  if (wsRole !== "workspace_admin") return error("Only workspace admins can create projects", 403);

  const exists = await Project.findOne({ workspace: data.workspace, key: data.key.toUpperCase() });
  if (exists) return error(`A project with key ${data.key.toUpperCase()} already exists in this workspace`, 409);

  // Seed the project with every workspace member (creator becomes project admin).
  const ws = await Workspace.findById(data.workspace).select("members");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = ((ws?.members || []) as any[]).map((m) => ({
    user: m.user,
    role: String(m.user) === String(user!._id) ? "project_admin" : m.role === "workspace_admin" ? "project_admin" : "developer",
  }));
  if (!members.some((m) => String(m.user) === String(user!._id))) {
    members.push({ user: user!._id, role: "project_admin" });
  }

  const project = await Project.create({
    workspace: data.workspace,
    name: data.name,
    key: data.key.toUpperCase(),
    description: data.description || "",
    lead: user!._id,
    members,
    statuses: DEFAULT_STATUSES,
    labels: [
      { id: "frontend", name: "Frontend", color: "#3b82f6" },
      { id: "backend", name: "Backend", color: "#8b5cf6" },
      { id: "design", name: "Design", color: "#ec4899" },
    ],
  });

  await logActivity({
    project: String(project._id),
    workspace: data.workspace,
    user: String(user!._id),
    action: "project.created",
    detail: `Created project "${project.name}" (${project.key})`,
  });
  return json({ project }, 201);
}
