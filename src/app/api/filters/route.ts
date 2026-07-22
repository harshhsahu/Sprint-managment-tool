import { z } from "zod";
import { withAuth, json, error, parseBody } from "@/lib/apiHelpers";
import { SavedFilter } from "@/models";

export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const project = new URL(req.url).searchParams.get("project");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { user: user!._id };
  if (project) filter.$or = [{ project }, { project: null }];
  const filters = await SavedFilter.find(filter).sort({ createdAt: -1 });
  return json({ filters });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  project: z.string().nullable().optional(),
  filters: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const { data, res: bodyErr } = await parseBody(req, createSchema);
  if (bodyErr) return bodyErr;

  const saved = await SavedFilter.create({
    user: user!._id,
    name: data.name,
    project: data.project || null,
    filters: data.filters,
  });
  return json({ filter: saved }, 201);
}

export async function DELETE(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error("id is required");
  await SavedFilter.deleteOne({ _id: id, user: user!._id });
  return json({ ok: true });
}
