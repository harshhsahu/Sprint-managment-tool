import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, error, parseBody } from "@/lib/apiHelpers";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) return error("Invalid email or password", 401);
  if (!user.active) return error("This account has been deactivated", 403);

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) return error("Invalid email or password", 401);

  const token = await signSession({
    userId: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
}
