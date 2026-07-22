import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, error, parseBody } from "@/lib/apiHelpers";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(128) });

export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  const user = await User.findOne({
    resetToken: data.token,
    resetTokenExpiry: { $gt: new Date() },
  });
  if (!user) return error("Invalid or expired reset token", 400);

  user.passwordHash = await bcrypt.hash(data.password, 10);
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  return json({ ok: true });
}
