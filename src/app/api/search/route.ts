import { withAuth, json } from "@/lib/apiHelpers";
import { Task, Project, Sprint, User, Workspace } from "@/models";

/** Global search across tasks, projects, sprints and people. ?q= */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return json({ tasks: [], projects: [], sprints: [], users: [] });

  // restrict to projects the user can see: every project in a workspace they
  // belong to, plus any project they guest on.
  const myWorkspaces = await Workspace.find({
    $or: [{ owner: user!._id }, { "members.user": user!._id }],
  }).select("_id");
  const projectFilter = {
    $or: [
      { workspace: { $in: myWorkspaces.map((w) => w._id) } },
      { "members.user": user!._id },
    ],
  };
  const visibleProjects = await Project.find(projectFilter).select("_id name key");
  const projectIds = visibleProjects.map((p) => p._id);

  const rx = { $regex: q, $options: "i" };
  const [tasks, projects, sprints, users] = await Promise.all([
    Task.find({
      project: { $in: projectIds },
      archived: false,
      $or: [{ title: rx }, { key: rx }, { description: rx }],
    })
      .populate("assignee", "name avatarColor")
      .select("title key type status priority project assignee")
      .limit(20),
    Project.find({ _id: { $in: projectIds }, $or: [{ name: rx }, { key: rx }] }).select("name key workspace").limit(5),
    Sprint.find({ project: { $in: projectIds }, name: rx }).select("name status project").limit(5),
    User.find({ active: true, $or: [{ name: rx }, { email: rx }] }).select("name email avatarColor designation").limit(5),
  ]);

  return json({ tasks, projects, sprints, users });
}
