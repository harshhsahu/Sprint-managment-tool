import { Project, Workspace } from "@/models";
import type { ProjectRole } from "./constants";

/* Role-based access control helpers.
   Global:   super_admin > member
   Workspace: workspace_admin > member
   Project:  project_admin > team_lead > developer/qa > viewer */

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

export async function getWorkspaceRole(user: UserDoc, workspaceId: string): Promise<string | null> {
  if (isSuperAdmin(user)) return "workspace_admin";
  const ws = await Workspace.findById(workspaceId).select("owner members");
  if (!ws) return null;
  if (String(ws.owner) === String(user._id)) return "workspace_admin";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = ws.members.find((m: any) => String(m.user) === String(user._id));
  return m ? m.role : null;
}

export async function getProjectRole(user: UserDoc, projectId: string): Promise<ProjectRole | null> {
  if (isSuperAdmin(user)) return "project_admin";
  const project = await Project.findById(projectId).select("members workspace lead");
  if (!project) return null;
  if (String(project.lead) === String(user._id)) return "project_admin";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = project.members.find((m: any) => String(m.user) === String(user._id));
  if (m) return m.role;
  // workspace admins get project admin rights
  const wsRole = await getWorkspaceRole(user, String(project.workspace));
  if (wsRole === "workspace_admin") return "project_admin";
  return null;
}

export function roleAtLeast(role: string | null, min: ProjectRole): boolean {
  if (!role) return false;
  return (PROJECT_ROLE_RANK[role] ?? 0) >= (PROJECT_ROLE_RANK[min] ?? 99);
}

/** Convenience: can this user edit tasks (anything above viewer)? */
export async function canEditProject(user: UserDoc, projectId: string): Promise<boolean> {
  const role = await getProjectRole(user, projectId);
  return roleAtLeast(role, "developer");
}

export async function canAdminProject(user: UserDoc, projectId: string): Promise<boolean> {
  const role = await getProjectRole(user, projectId);
  return roleAtLeast(role, "project_admin");
}

export async function canViewProject(user: UserDoc, projectId: string): Promise<boolean> {
  const role = await getProjectRole(user, projectId);
  return role !== null;
}
