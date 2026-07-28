import { z } from "zod";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { json, error, parseBody } from "@/lib/apiHelpers";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { avatarColor } from "@/lib/utils";
import { isSuperAdminEmail } from "@/lib/constants";
import { getAdminAuth } from "@/lib/firebase/admin";

// The Firebase user is created client-side; we receive its ID token plus the
// profile fields we store in Mongo.
const schema = z.object({
  idToken: z.string().min(1),
  name: z.string().min(2).max(80),
  designation: z.string().max(80).optional(),
  timezone: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  await dbConnect();
  const { data, res } = await parseBody(req, schema);
  if (res) return res;

  try {
    const auth = getAdminAuth(); // throws here if the server is misconfigured → logged 500 below
    let decoded;
    try {
      decoded = await auth.verifyIdToken(data.idToken);
    } catch {
      return error("Invalid or expired sign-in token", 401);
    }

    const email = decoded.email?.toLowerCase();
    if (!email) return error("Firebase account has no email", 400);

    const existing = await User.findOne({ $or: [{ email }, { firebaseUid: decoded.uid }] });
    if (existing) return error("An account with this email already exists", 409);

    const user = await User.create({
      name: data.name,
      email,
      firebaseUid: decoded.uid,
      designation: data.designation || "",
      timezone: data.timezone || "UTC",
      avatarColor: avatarColor(email),
      role: isSuperAdminEmail(email) ? "super_admin" : "member", // super admin is the one designated email
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
  } catch (e) {
    // A duplicate-key race (E11000) means the account already exists; anything
    // else is logged and returned as JSON so the client never gets a raw HTML 500.
    if ((e as { code?: number })?.code === 11000) {
      return error("An account with this email already exists", 409);
    }
    console.error("[auth/register] failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return error("Could not complete registration. Please try again.", 500, { detail });
  }
}
