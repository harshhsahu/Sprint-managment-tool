import { withAuth, json, error } from "@/lib/apiHelpers";
import { Activity } from "@/models";
import { getProjectRole, isSuperAdmin } from "@/lib/permissions";

/** Activity / audit log. ?project= or ?task= or ?user=me, paginated. */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Number(sp.get("limit")) || 30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = {};
  const projectId = sp.get("project");
  if (projectId) {
    const role = await getProjectRole(user, projectId);
    if (!role) return error("Access denied", 403);
    filter.project = projectId;
  }
  if (sp.get("task")) filter.task = sp.get("task");
  if (sp.get("user") === "me") filter.user = user!._id;
  if (!projectId && sp.get("user") !== "me" && !isSuperAdmin(user)) {
    filter.user = user!._id; // non-admins can't browse the global audit log
  }

  const [items, total] = await Promise.all([
    Activity.find(filter)
      .populate("user", "name email avatarColor")
      .populate("task", "key title")
      .populate("project", "name key")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Activity.countDocuments(filter),
  ]);
  return json({ activity: items, total, page, pages: Math.ceil(total / limit) });
}
