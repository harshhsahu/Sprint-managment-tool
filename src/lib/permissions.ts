import { Project, Workspace } from "@/models";
import { ROLE_CAPS, isSuperAdminEmail, type Capability, type Role } from "./constants";

/* Role-based access control.

   One role set — owner > admin > editor > viewer — is used at both the workspace
   and project level.

   ACCESS MODEL:
   - A **workspace member** (including the owner) automatically has that role on
     EVERY project in the workspace. There is no need to add them per-project.
   - A **project guest** is a user who is NOT a workspace member but has been given
     access to a single project (stored in `project.members`). They can only reach
     that project.
   - `super_admin` is a GLOBAL role for user administration only (see /api/users) and
     does NOT grant access to any workspace/project it isn't a member of.

   Permissions are capability-based: a role resolves to a capability set (ROLE_CAPS). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserDoc = any;

const RANK: Record<Role, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

/** Super-admin is anchored to a single designated email (see SUPER_ADMIN_EMAIL),
    not the mutable DB role, so no one can be granted it by editing a role field. */
export function isSuperAdmin(user: UserDoc): boolean {
  return isSuperAdminEmail(user?.email);
}

/** Workspace role for a user (owner/admin/editor/viewer), or null if not a member. */
export async function getWorkspaceRole(user: UserDoc, workspaceId: string): Promise<Role | null> {
  const ws = await Workspace.findById(workspaceId).select("owner members");
  if (!ws) return null;
  if (String(ws.owner) === String(user._id)) return "owner";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = ws.members.find((m: any) => String(m.user) === String(user._id));
  return (m?.role as Role) || null;
}

/** Effective project role for a user, or null if no access.
    Workspace membership wins (grants all projects); otherwise a project-guest role. */
export async function getProjectRole(user: UserDoc, projectId: string): Promise<Role | null> {
  const project = await Project.findById(projectId).select("members workspace excludedMembers");
  if (!project) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excluded = (project.excludedMembers || []).some((id: any) => String(id) === String(user._id));
  // An excluded workspace member loses their workspace-derived access to this project.
  const wsRole = excluded ? null : await getWorkspaceRole(user, String(project.workspace));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guest = project.members.find((m: any) => String(m.user) === String(user._id));
  const guestRole = (guest?.role as Role) || null;

  if (wsRole && guestRole) return RANK[wsRole] >= RANK[guestRole] ? wsRole : guestRole;
  return wsRole || guestRole;
}

/** All capabilities a user has on a project. */
export async function getCapabilities(user: UserDoc, projectId: string): Promise<Set<Capability>> {
  const role = await getProjectRole(user, projectId);
  return new Set(role ? ROLE_CAPS[role] : []);
}

/** Does the user have a specific capability on a project? */
export async function can(user: UserDoc, projectId: string, capability: Capability): Promise<boolean> {
  return (await getCapabilities(user, projectId)).has(capability);
}

/** True when the user can administer the workspace (owner or admin). */
export function isWorkspaceManager(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}
