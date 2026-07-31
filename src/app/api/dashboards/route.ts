import { z } from "zod";
import { withAuth, json, error, parseBody } from "@/lib/apiHelpers";
import { Dashboard, Workspace, Project } from "@/models";

const WIDGET_TYPES = [
  "assigned_to_me", "sprint_progress", "recent_activity", "by_status", "by_priority",
  "by_assignee", "open_vs_closed", "upcoming_deadlines", "team_workload",
  // growth / trend widgets
  "project_growth", "velocity_trend", "throughput", "team_growth",
] as const;

/** Prefilled "Team Growth" board for owners / project leads. */
export const TEAM_GROWTH_TEMPLATE = [
  { id: "g1", type: "project_growth", w: 2, chartType: "area", range: "90d" },
  { id: "g2", type: "velocity_trend", w: 1, chartType: "bar" },
  { id: "g3", type: "throughput", w: 1, chartType: "bar", range: "90d" },
  { id: "g4", type: "team_growth", w: 2, chartType: "bar", range: "90d" },
  { id: "g5", type: "open_vs_closed", w: 2 },
];

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

    // Owners / project leads also get a ready-made growth board on first load.
    const [ownsWs, leadsProject] = await Promise.all([
      Workspace.exists({ owner: user!._id }),
      Project.exists({ lead: user!._id }),
    ]);
    if (ownsWs || leadsProject) {
      const team = await Dashboard.create({
        user: user!._id,
        name: "Team Growth",
        widgets: TEAM_GROWTH_TEMPLATE,
      });
      dashboards.push(team);
    }
  }
  return json({ dashboards });
}

const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(WIDGET_TYPES),
  w: z.number().min(1).max(2).default(1),
  project: z.string().nullable().optional(),
  chartType: z.enum(["pie", "donut", "bar", "line", "area"]).nullable().optional(),
  range: z.enum(["30d", "90d", "6m", "12m"]).nullable().optional(),
  projects: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

const filtersSchema = z.object({
  projects: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  lead: z.string().nullable().optional(),
  range: z.enum(["30d", "90d", "6m", "12m"]).nullable().optional(),
  priority: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
});

const upsertSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1).max(60),
  widgets: z.array(widgetSchema).max(20),
  filters: filtersSchema.optional(),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, upsertSchema);
  if (bodyErr) return bodyErr;

  const set: Record<string, unknown> = { name: data.name, widgets: data.widgets };
  if (data.filters !== undefined) set.filters = data.filters;

  if (data._id) {
    const dash = await Dashboard.findOneAndUpdate(
      { _id: data._id, user: user!._id },
      { $set: set },
      { new: true }
    );
    if (!dash) return error("Dashboard not found", 404);
    return json({ dashboard: dash });
  }
  const dash = await Dashboard.create({ user: user!._id, ...set });
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
