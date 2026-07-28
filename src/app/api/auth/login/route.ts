import { z } from "zod";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, error, parseBody } from "@/lib/apiHelpers";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { avatarColor } from "@/lib/utils";
import { isSuperAdminEmail } from "@/lib/constants";
import { adminAuth } from "@/lib/firebase/admin";

// The client signs in with Firebase (email/password or Google) and sends the
// resulting ID token here.
const schema = z.object({ idToken: z.string().min(1) });

export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(data.idToken);
  } catch {
    return error("Invalid or expired sign-in token", 401);
  }

  const email = decoded.email?.toLowerCase();
  // Match by Firebase UID first, then fall back to email (and backfill the UID
  // for accounts created before the Firebase migration).
  let user = await User.findOne({ firebaseUid: decoded.uid });
  if (!user && email) {
    user = await User.findOne({ email });
    if (user && !user.firebaseUid) {
      user.firebaseUid = decoded.uid;
      await user.save();
    }
  }

  // Auto-provision on first Google sign-in: a Google user authenticates with
  // Firebase but has no Mongo profile yet, so create one from the token claims.
  if (!user && email) {
    user = await User.create({
      name: decoded.name || email.split("@")[0],
      email,
      firebaseUid: decoded.uid,
      avatarColor: avatarColor(email),
      role: isSuperAdminEmail(email) ? "super_admin" : "member",
    });
  }

  if (!user) return error("No account found for this user", 401);
  if (!user.active) return error("This account has been deactivated", 403);

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
