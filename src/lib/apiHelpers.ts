import { NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";
import { requireUser } from "./auth";
import { dbConnect } from "./db";
import { Activity, Notification } from "@/models";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Authenticate + connect DB. Returns { user } or a NextResponse error. */
export async function withAuth() {
  await dbConnect();
  const user = await requireUser();
  if (!user) return { user: null, res: error("Unauthorized", 401) };
  return { user, res: null };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T; res: null } | { data: null; res: NextResponse }> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { data, res: null };
  } catch (e) {
    if (e instanceof ZodError) {
      const msg = e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { data: null, res: error(msg, 422) };
    }
    return { data: null, res: error("Invalid JSON body", 400) };
  }
}

/* ----------------------- activity + notifications ----------------------- */

export async function logActivity(entry: {
  project?: string | null;
  workspace?: string | null;
  task?: string | null;
  sprint?: string | null;
  user: string;
  action: string;
  detail?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
}) {
  try {
    await Activity.create(entry);
  } catch (e) {
    console.error("Failed to log activity", e);
  }
}

export async function notify(entry: {
  user: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  actor?: string;
}) {
  try {
    if (entry.actor && String(entry.user) === String(entry.actor)) return; // don't notify yourself
    await Notification.create(entry);
  } catch (e) {
    console.error("Failed to create notification", e);
  }
}
