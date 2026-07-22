import crypto from "crypto";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, parseBody } from "@/lib/apiHelpers";

const schema = z.object({ email: z.string().email() });

/* Generates a reset token. In production this would be emailed; in this
   self-hosted setup the token is returned so an admin can share the link. */
export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) return json({ ok: true }); // don't leak account existence

  const token = crypto.randomBytes(32).toString("hex");
  user.resetToken = token;
  user.resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await user.save();

  return json({ ok: true, resetLink: `/reset-password?token=${token}` });
}
