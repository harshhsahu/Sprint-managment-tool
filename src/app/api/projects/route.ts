import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { Project, Workspace } from "@/models";
import { getWorkspaceRole, isWorkspaceManager, isWorkspaceExpired } from "@/lib/permissions";
import { DEFAULT_STATUSES } from "@/lib/constants";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace");

  // Workspace membership (any role) grants access to every project in the workspace.
  // Project guests (non-members) see only projects they've been added to.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { archived: { $ne: true } };
  if (workspaceId) {
    const role = await getWorkspaceRole(user, workspaceId);
    filter.workspace = workspaceId;
    if (!role) filter["members.user"] = user!._id; // not a ws member → only guest projects
  } else {
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: user!._id }, { "members.user": user!._id }],
    }).select("_id");
    filter.$or = [
      { workspace: { $in: myWorkspaces.map((w) => w._id) } }, // all projects in my workspaces
      { "members.user": user!._id }, // + projects I'm a guest on
    ];
  }

  const projects = await Project.find(filter)
    .populate("lead", "name email avatarColor")
    .populate("members.user", "name email avatarColor")
    .populate({
      path: "workspace",
      select: "name owner members",
      populate: [
        { path: "owner", select: "name email avatarColor active" },
        { path: "members.user", select: "name email avatarColor designation active" },
      ],
    })
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
  if (!isWorkspaceManager(wsRole)) return error("Only workspace owners and admins can create projects", 403);

  // Read-only gate: an expired-plan workspace can't create new content.
  if (await isWorkspaceExpired(data.workspace)) {
    return error("This workspace is read-only because its plan has expired. Contact your admin to upgrade.", 403);
  }

  const exists = await Project.findOne({ workspace: data.workspace, key: data.key.toUpperCase() });
  if (exists) return error(`A project with key ${data.key.toUpperCase()} already exists in this workspace`, 409);

  // No member copies — everyone in the workspace already has access. `members` holds
  // only project guests (users outside the workspace), added later.
  const project = await Project.create({
    workspace: data.workspace,
    name: data.name,
    key: data.key.toUpperCase(),
    description: data.description || "",
    lead: user!._id,
    members: [],
    statuses: DEFAULT_STATUSES,
    // Starter "Labels" field — labels are now a user-defined multiselect custom field.
    customFields: [
      {
        id: "labels",
        name: "Labels",
        type: "multiselect",
        options: [
          { id: "frontend", name: "Frontend", color: "#3b82f6" },
          { id: "backend", name: "Backend", color: "#8b5cf6" },
          { id: "design", name: "Design", color: "#ec4899" },
        ],
      },
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
