import { z } from "zod";
import { withAuth, json, parseBody } from "@/lib/apiHelpers";
import { Notification } from "@/models";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const sp = new URL(req.url).searchParams;
  const unreadOnly = sp.get("unread") === "1";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { user: user!._id };
  if (unreadOnly) filter.read = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).populate("actor", "name avatarColor").sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: user!._id, read: false }),
  ]);
  return json({ notifications, unreadCount });
}

const patchSchema = z.object({
  ids: z.array(z.string()).optional(), // omit = mark all read
  read: z.boolean().default(true),
});

export async function PATCH(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, patchSchema);
  if (bodyErr) return bodyErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { user: user!._id };
  if (data.ids?.length) filter._id = { $in: data.ids };
  await Notification.updateMany(filter, { $set: { read: data.read } });
  return json({ ok: true });
}
