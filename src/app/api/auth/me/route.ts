import { z } from "zod";
import { withAuth, json, parseBody } from "@/lib/apiHelpers";
import { User } from "@/models";

export async function GET() {
  const { user, res } = await withAuth();
  if (res) return res;
  return json({ user });
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  designation: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
  avatarColor: z.string().max(20).optional(),
});

export async function PATCH(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  const updated = await User.findByIdAndUpdate(user!._id, { $set: data }, { new: true }).select("-passwordHash");
  return json({ user: updated });
}
