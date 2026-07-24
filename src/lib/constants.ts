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

/* One unified role set used at BOTH the workspace and project level.
   - owner  : the creator; full control incl. deleting the workspace/project
   - admin  : manage members, settings, sprints, and all task actions
   - editor : create / edit / comment on tasks (no delete, no sprint management)
   - viewer : read-only
   Workspace membership grants that role across EVERY project in the workspace;
   a "project guest" (not a workspace member) can be given admin/editor/viewer on a
   single project. */
export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Roles assignable via a dropdown (owner is reserved for the creator). */
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const;

export const ROLE_LABELS: Record<string, string> = {
  // global user roles (user administration only)
  super_admin: "Super Admin",
  member: "Member",
  // workspace/project roles
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including deleting the workspace/project",
  admin: "Manage members, settings, sprints, and all tasks",
  editor: "Create, edit, and comment on tasks",
  viewer: "Read-only access",
};

/* ---------------------- Capabilities (RBAC) ----------------------
   Permissions are capability-based. Each role maps to a fixed set of capabilities. */
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

const ALL_CAPS: Capability[] = [...CAPABILITIES];

/** Capabilities granted by each role. */
export const ROLE_CAPS: Record<Role, Capability[]> = {
  owner: ALL_CAPS,
  admin: ALL_CAPS,
  editor: ["project:view", "task:create", "task:edit", "task:comment"],
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

/* Built-in task fields a project can show/hide. Core fields (title, type, status,
   priority, assignee, reporter, description) are always shown and not listed here. */
export const OPTIONAL_TASK_FIELDS = [
  { id: "sprint", label: "Sprint" },
  { id: "epic", label: "Epic" },
  { id: "storyPoints", label: "Story points" },
  { id: "dueDate", label: "Due date" },
  { id: "labels", label: "Labels" },
  { id: "dependencies", label: "Dependencies" },
  { id: "watchers", label: "Watchers" },
] as const;

/* Custom fields a project can add to its tasks (e.g. "ETA"). */
export const CUSTOM_FIELD_TYPES = ["text", "number", "date"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
];
