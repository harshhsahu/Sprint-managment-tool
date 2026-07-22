import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { User } from "@/models";

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["super_admin", "member"]).optional(),
  designation: z.string().max(80).optional(),
});

/** Super-admin only: activate/deactivate accounts, change global role. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  if (user!.role !== "super_admin") return error("Only a super admin can manage users", 403);

  const { id } = await params;
  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  if (String(user!._id) === id && data.active === false) {
    return error("You cannot deactivate your own account", 400);
  }

  const updated = await User.findByIdAndUpdate(id, { $set: data }, { new: true }).select("-passwordHash");
  if (!updated) return error("User not found", 404);

  await logActivity({
    user: String(user!._id),
    action: "user.updated",
    detail: `Updated user ${updated.name}`,
    meta: data,
  });
  return json({ user: updated });
}
