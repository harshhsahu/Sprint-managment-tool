import { z } from "zod";
import { withAuth, json, error, parseBody, logActivity, notify } from "@/lib/apiHelpers";
import { Task, Comment, User } from "@/models";
import { can } from "@/lib/permissions";

const schema = z.object({ body: z.string().min(1).max(10000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { id } = await params;

  const task = await Task.findById(id);
  if (!task) return error("Task not found", 404);

  if (!(await can(user, String(task.project), "task:comment"))) return error("You don't have permission to comment", 403);

  const { data, res: bodyErr } = await parseBody(req, schema);
  if (bodyErr) return bodyErr;

  // resolve @mentions of the form @[Name](userId) or plain @email
  const mentionIds = [...data.body.matchAll(/@\[[^\]]+\]\(([a-f0-9]{24})\)/g)].map((m) => m[1]);
  const emailMentions = [...data.body.matchAll(/@([\w.+-]+@[\w-]+\.[\w.]+)/g)].map((m) => m[1]);
  if (emailMentions.length) {
    const users = await User.find({ email: { $in: emailMentions } }).select("_id");
    mentionIds.push(...users.map((u) => String(u._id)));
  }

  const comment = await Comment.create({
    task: id,
    author: user!._id,
    body: data.body,
    mentions: [...new Set(mentionIds)],
  });

  for (const m of new Set(mentionIds)) {
    await notify({
      user: m, type: "mention", actor: String(user!._id),
      title: `${user!.name} mentioned you on ${task.key}`,
      body: data.body.slice(0, 140), link: `/p/${task.project}/board?task=${task._id}`,
    });
  }
  // notify watchers (excluding mentioned users, who already got one)
  for (const w of task.watchers || []) {
    if (mentionIds.includes(String(w))) continue;
    await notify({
      user: String(w), type: "comment", actor: String(user!._id),
      title: `${user!.name} commented on ${task.key}`,
      body: data.body.slice(0, 140), link: `/p/${task.project}/board?task=${task._id}`,
    });
  }
  await logActivity({
    project: String(task.project), task: id, user: String(user!._id),
    action: "task.commented", detail: `Commented on ${task.key}`,
  });

  const populated = await Comment.findById(comment._id).populate("author", "name email avatarColor");
  return json({ comment: populated }, 201);
}
