import { Workspace, Project, WorkspaceInvite, ProjectInvite } from "@/models";
import { notify, logActivity } from "./apiHelpers";

/** Add a user to a workspace and every project it contains, skipping any
    membership they already have. Idempotent. Returns the number of projects
    the user was newly added to. */
export async function addUserToWorkspace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspace: any,
  userId: string,
  role: "workspace_admin" | "member"
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!workspace.members.some((m: any) => String(m.user) === String(userId))) {
    workspace.members.push({ user: userId, role });
    await workspace.save();
  }

  const projectRole = role === "workspace_admin" ? "project_admin" : "developer";
  const projects = await Project.find({ workspace: workspace._id });
  let added = 0;
  for (const project of projects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (project.members.some((m: any) => String(m.user) === String(userId))) continue;
    project.members.push({ user: userId, role: projectRole });
    await project.save();
    added++;
  }
  return added;
}

/** Add a user to a single project, skipping it if they are already a member.
    Idempotent. Returns true if the user was newly added. */
export async function addUserToProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any,
  userId: string,
  role: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (project.members.some((m: any) => String(m.user) === String(userId))) return false;
  project.members.push({ user: userId, role });
  await project.save();
  return true;
}

/** Apply any pending invitations addressed to a freshly registered user's
    email — both workspace-wide invites (join the workspace + all its projects)
    and single-project invites — notify them, then remove the consumed invite
    records. Safe to call for any user. */
export async function materializePendingInvites(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
): Promise<void> {
  const email = String(user.email).toLowerCase();

  const wsInvites = await WorkspaceInvite.find({ email });
  for (const invite of wsInvites) {
    const workspace = await Workspace.findById(invite.workspace);
    if (!workspace) {
      await invite.deleteOne();
      continue;
    }

    await addUserToWorkspace(workspace, String(user._id), invite.role);

    await notify({
      user: String(user._id),
      type: "invite",
      title: `You were added to workspace "${workspace.name}"`,
      link: `/w/${workspace._id}`,
      actor: invite.invitedBy ? String(invite.invitedBy) : undefined,
    });
    await logActivity({
      workspace: String(workspace._id),
      user: invite.invitedBy ? String(invite.invitedBy) : String(user._id),
      action: "workspace.member_added",
      detail: `${user.name} accepted an invitation and joined the workspace`,
    });

    await invite.deleteOne();
  }

  const projInvites = await ProjectInvite.find({ email });
  for (const invite of projInvites) {
    const project = await Project.findById(invite.project);
    if (!project) {
      await invite.deleteOne();
      continue;
    }

    const added = await addUserToProject(project, String(user._id), invite.role);
    if (added) {
      await notify({
        user: String(user._id),
        type: "invite",
        title: `You were added to project "${project.name}"`,
        link: `/p/${project._id}/board`,
        actor: invite.invitedBy ? String(invite.invitedBy) : undefined,
      });
      await logActivity({
        project: String(project._id),
        workspace: String(project.workspace),
        user: invite.invitedBy ? String(invite.invitedBy) : String(user._id),
        action: "project.member_added",
        detail: `${user.name} accepted an invitation and joined the project`,
      });
    }

    await invite.deleteOne();
  }
}
