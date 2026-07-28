import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity } from "@/lib/apiHelpers";
import { isSuperAdmin } from "@/lib/permissions";
import { User } from "@/models";

// The global super-admin role is anchored to a fixed email (see SUPER_ADMIN_EMAIL)
// and is NOT assignable here — only account status and designation are editable.
const patchSchema = z.object({
  active: z.boolean().optional(),
  designation: z.string().max(80).optional(),
});

/** Super-admin only: activate/deactivate accounts, set designation. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  if (!isSuperAdmin(user)) return error("Only the super admin can manage users", 403);

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
