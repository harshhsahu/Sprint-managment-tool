import { Project, Workspace } from "@/models";
import { BUILTIN_ROLE_CAPS, type Capability, type ProjectRole } from "./constants";

/* Role-based access control.
   Visibility is strictly scoped: a user only reaches a workspace/project they
   own or are a member of. `super_admin` is a global role for USER administration
   only (see /api/users) — it does NOT grant access to other users' workspaces.

   Project permissions are capability-based. A member's role is either a built-in
   role (project_admin/team_lead/developer/qa/viewer) or a workspace-defined
   custom role id; each resolves to a set of capabilities. */

const PROJECT_ROLE_RANK: Record<string, number> = {
  project_admin: 4,
  team_lead: 3,
  developer: 2,
  qa: 2,
  viewer: 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserDoc = any;

export function isSuperAdmin(user: UserDoc): boolean {
  return user?.role === "super_admin";
}

/** Workspace role for a user, or null if they are not a member. */
export async function getWorkspaceRole(user: UserDoc, workspaceId: string): Promise<string | null> {
  const ws = await Workspace.findById(workspaceId).select("owner members");
  if (!ws) return null;
  if (String(ws.owner) === String(user._id)) return "workspace_admin";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = ws.members.find((m: any) => String(m.user) === String(user._id));
  return m ? m.role : null;
}

/** Project role id for a user (built-in or custom role id), or null if no access. */
export async function getProjectRole(user: UserDoc, projectId: string): Promise<string | null> {
  const project = await Project.findById(projectId).select("members workspace lead");
  if (!project) return null;
  if (String(project.lead) === String(user._id)) return "project_admin";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = project.members.find((m: any) => String(m.user) === String(user._id));
  if (m) return m.role;
  // workspace admins administer every project in their workspace
  const wsRole = await getWorkspaceRole(user, String(project.workspace));
  if (wsRole === "workspace_admin") return "project_admin";
  return null;
}

/** Rank comparison for built-in roles only (used where custom roles don't apply). */
export function roleAtLeast(role: string | null, min: ProjectRole): boolean {
  if (!role) return false;
  return (PROJECT_ROLE_RANK[role] ?? 0) >= (PROJECT_ROLE_RANK[min] ?? 99);
}

/** Resolve a role id to its capability set, consulting workspace custom roles. */
async function capsForRole(roleId: string | null, workspaceId: string): Promise<Set<Capability>> {
  if (!roleId) return new Set();
  if (roleId in BUILTIN_ROLE_CAPS) return new Set(BUILTIN_ROLE_CAPS[roleId as ProjectRole]);
  const ws = await Workspace.findById(workspaceId).select("customRoles");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cr = (ws?.customRoles || []).find((r: any) => r.id === roleId);
  return new Set<Capability>(cr?.capabilities || []);
}

/** All capabilities a user has on a project. */
export async function getCapabilities(user: UserDoc, projectId: string): Promise<Set<Capability>> {
  const project = await Project.findById(projectId).select("workspace");
  if (!project) return new Set();
  const roleId = await getProjectRole(user, projectId);
  return capsForRole(roleId, String(project.workspace));
}

/** Does the user have a specific capability on a project? */
export async function can(user: UserDoc, projectId: string, capability: Capability): Promise<boolean> {
  return (await getCapabilities(user, projectId)).has(capability);
}
