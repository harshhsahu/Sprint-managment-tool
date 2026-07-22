import { withAuth, json } from "@/lib/apiHelpers";
import { Task, Project, Sprint, User, Workspace } from "@/models";
import { isSuperAdmin } from "@/lib/permissions";

/** Global search across tasks, projects, sprints and people. ?q= */
export async function GET(req: Request) {
  const { user, res } = await withAuth();
  if (res) return res;
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return json({ tasks: [], projects: [], sprints: [], users: [] });

  // restrict to projects the user can see
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectFilter: any = {};
  if (!isSuperAdmin(user)) {
    const myWorkspaces = await Workspace.find({
      $or: [{ owner: user!._id }, { "members.user": user!._id, "members.role": "workspace_admin" }],
    }).select("_id");
    projectFilter = {
      $or: [
        { "members.user": user!._id },
        { lead: user!._id },
        { workspace: { $in: myWorkspaces.map((w) => w._id) } },
      ],
    };
  }
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
