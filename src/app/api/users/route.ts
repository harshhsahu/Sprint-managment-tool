import { withAuth, json } from "@/lib/apiHelpers";
import { User } from "@/models";

/** List users (for member pickers, invites). Any authenticated user can list active users. */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const includeInactive = searchParams.get("all") === "1" && user!.role === "super_admin";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = includeInactive ? {} : { active: true };
  if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];

  const users = await User.find(filter).select("-passwordHash -resetToken -resetTokenExpiry").sort({ name: 1 }).limit(100);
  return json({ users });
}
