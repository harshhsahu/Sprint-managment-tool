import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { dbConnect } from "./db";
import { User } from "@/models";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
export const SESSION_COOKIE = "sm_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string; // global role: super_admin | member
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Read session from cookie in a route handler / server component. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Get session and ensure the user still exists and is active. Returns null otherwise. */
export async function requireUser() {
  const session = await getSession();
  if (!session) return null;
  await dbConnect();
  const user = await User.findById(session.userId).select("-passwordHash");
  if (!user || !user.active) return null;
  return user;
}
