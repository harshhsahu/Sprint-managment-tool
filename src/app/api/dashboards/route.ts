import { z } from "zod";
import { withAuth, json, error, parseBody } from "@/lib/apiHelpers";
import { Dashboard } from "@/models";

const WIDGET_TYPES = [
  "assigned_to_me", "sprint_progress", "recent_activity", "by_status", "by_priority",
  "by_assignee", "open_vs_closed", "upcoming_deadlines", "team_workload",
] as const;

export async function GET() {
  const { user, res } = await withAuth();
  if (res) return res;
  let dashboards = await Dashboard.find({ user: user!._id }).sort({ createdAt: 1 });
  if (dashboards.length === 0) {
    const def = await Dashboard.create({
      user: user!._id,
      name: "My Dashboard",
      isDefault: true,
      widgets: [
        { id: "w1", type: "assigned_to_me", w: 1 },
        { id: "w2", type: "sprint_progress", w: 1 },
        { id: "w3", type: "by_status", w: 1 },
        { id: "w4", type: "upcoming_deadlines", w: 1 },
        { id: "w5", type: "recent_activity", w: 2 },
      ],
    });
    dashboards = [def];
  }
  return json({ dashboards });
}

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(WIDGET_TYPES),
  w: z.number().min(1).max(2).default(1),
  project: z.string().nullable().optional(),
});

const upsertSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1).max(60),
  widgets: z.array(widgetSchema).max(20),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, upsertSchema);
  if (bodyErr) return bodyErr;

  if (data._id) {
    const dash = await Dashboard.findOneAndUpdate(
      { _id: data._id, user: user!._id },
      { $set: { name: data.name, widgets: data.widgets } },
      { new: true }
    );
    if (!dash) return error("Dashboard not found", 404);
    return json({ dashboard: dash });
  }
  const dash = await Dashboard.create({ user: user!._id, name: data.name, widgets: data.widgets });
  return json({ dashboard: dash }, 201);
}

export async function DELETE(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error("id is required");
  const count = await Dashboard.countDocuments({ user: user!._id });
  if (count <= 1) return error("You must keep at least one dashboard", 400);
  await Dashboard.deleteOne({ _id: id, user: user!._id });
  return json({ ok: true });
}
