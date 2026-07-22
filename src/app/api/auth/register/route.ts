import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, error, parseBody } from "@/lib/apiHelpers";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { avatarColor } from "@/lib/utils";
import { cookies } from "next/headers";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  designation: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) return error("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const isFirstUser = (await User.countDocuments()) === 0;

  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    designation: data.designation || "",
    timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    avatarColor: avatarColor(data.email),
    role: isFirstUser ? "super_admin" : "member", // first user becomes super admin
  });

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

  return json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } }, 201);
}
