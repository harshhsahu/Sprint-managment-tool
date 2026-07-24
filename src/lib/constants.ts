export const TASK_TYPES = ["epic", "story", "task", "bug", "spike", "improvement", "subtask"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const PRIORITIES = ["highest", "high", "medium", "low", "lowest"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  highest: { label: "Highest", color: "#ef4444" },
  high: { label: "High", color: "#f97316" },
  medium: { label: "Medium", color: "#eab308" },
  low: { label: "Low", color: "#22c55e" },
  lowest: { label: "Lowest", color: "#3b82f6" },
};

export const TYPE_META: Record<TaskType, { label: string; color: string; icon: string }> = {
  epic: { label: "Epic", color: "#8b5cf6", icon: "Zap" },
  story: { label: "Story", color: "#22c55e", icon: "Bookmark" },
  task: { label: "Task", color: "#3b82f6", icon: "CheckSquare" },
  bug: { label: "Bug", color: "#ef4444", icon: "Bug" },
  spike: { label: "Spike", color: "#f59e0b", icon: "Search" },
  improvement: { label: "Improvement", color: "#06b6d4", icon: "TrendingUp" },
  subtask: { label: "Subtask", color: "#64748b", icon: "GitBranch" },
};

export const WORKSPACE_ROLES = ["workspace_admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_ROLES = ["project_admin", "team_lead", "developer", "qa", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  workspace_admin: "Workspace Admin",
  member: "Member",
  project_admin: "Project Admin",
  team_lead: "Team Lead",
  developer: "Developer",
  qa: "QA",
  viewer: "Viewer",
};

/* ---------------------- Capabilities (RBAC) ----------------------
   Permissions are capability-based. Built-in roles map to a fixed set of
   capabilities; workspace-defined custom roles pick their own set. */
export const CAPABILITIES = [
  "project:view",
  "task:create",
  "task:edit",
  "task:delete",
  "task:comment",
  "sprint:manage",
  "member:manage",
  "project:manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "project:view": "View project & tasks",
  "task:create": "Create tasks",
  "task:edit": "Edit tasks (status, fields, drag & drop)",
  "task:delete": "Delete tasks",
  "task:comment": "Comment on tasks",
  "sprint:manage": "Create & run sprints",
  "member:manage": "Manage project members & roles",
  "project:manage": "Edit project settings & delete project",
};

const ALL_CAPS: Capability[] = [...CAPABILITIES];

/** Capabilities granted by each built-in project role. */
export const BUILTIN_ROLE_CAPS: Record<ProjectRole, Capability[]> = {
  project_admin: ALL_CAPS,
  team_lead: ["project:view", "task:create", "task:edit", "task:delete", "task:comment", "sprint:manage"],
  developer: ["project:view", "task:create", "task:edit", "task:comment"],
  qa: ["project:view", "task:create", "task:edit", "task:comment"],
  viewer: ["project:view"],
};

export const DEFAULT_STATUSES = [
  { id: "backlog", name: "Backlog", color: "#64748b", category: "todo", order: 0, wipLimit: 0 },
  { id: "todo", name: "To Do", color: "#3b82f6", category: "todo", order: 1, wipLimit: 0 },
  { id: "in_progress", name: "In Progress", color: "#eab308", category: "in_progress", order: 2, wipLimit: 5 },
  { id: "in_review", name: "In Review", color: "#8b5cf6", category: "in_progress", order: 3, wipLimit: 3 },
  { id: "done", name: "Done", color: "#22c55e", category: "done", order: 4, wipLimit: 0 },
];

export const STATUS_CATEGORIES = ["todo", "in_progress", "done"] as const;

export const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
];
