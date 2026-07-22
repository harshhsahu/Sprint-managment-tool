import { z } from "zod";
import { withAuth, json, parseBody, logActivity } from "@/lib/apiHelpers";
import { Workspace } from "@/models";
import { isSuperAdmin } from "@/lib/permissions";

export async function GET() {
  const { user, res } = await withAuth();
  if (res) return res;

  const filter = isSuperAdmin(user)
    ? {}
    : { $or: [{ owner: user!._id }, { "members.user": user!._id }] };
  const workspaces = await Workspace.find(filter)
    .populate("owner", "name email avatarColor")
    .populate("members.user", "name email avatarColor designation")
    .sort({ createdAt: 1 });
  return json({ workspaces });
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  const workspace = await Workspace.create({
    name: data.name,
    description: data.description || "",
    owner: user!._id,
    members: [{ user: user!._id, role: "workspace_admin" }],
  });

  await logActivity({
    workspace: String(workspace._id),
    user: String(user!._id),
    action: "workspace.created",
    detail: `Created workspace "${workspace.name}"`,
  });
  return json({ workspace }, 201);
}
