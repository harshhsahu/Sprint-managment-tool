import { z } from "zod";
import { withAuth, json, parseBody, logActivity } from "@/lib/apiHelpers";
import { isSuperAdmin } from "@/lib/permissions";
import { Workspace } from "@/models";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;

  const { searchParams } = new URL(req.url);
  // Super-admin plan dashboard: `?all=1` lists every workspace regardless of
  // membership so plans can be reviewed/assigned. Ignored for everyone else.
  const all = searchParams.get("all") === "1" && isSuperAdmin(user);

  // strict isolation: only workspaces the user owns or belongs to
  const filter = all ? {} : { $or: [{ owner: user!._id }, { "members.user": user!._id }] };
  const workspaces = await Workspace.find(filter)
    .populate("owner", "name email avatarColor")
    .populate("members.user", "name email avatarColor designation active")
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
    members: [{ user: user!._id, role: "owner" }],
  });

  await logActivity({
    workspace: String(workspace._id),
    user: String(user!._id),
    action: "workspace.created",
    detail: `Created workspace "${workspace.name}"`,
  });
  return json({ workspace }, 201);
}
