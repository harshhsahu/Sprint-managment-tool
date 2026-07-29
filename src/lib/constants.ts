/* ---------------------------- Task types ----------------------------
   Task types are now configurable PER PROJECT (like statuses). A project
   stores its own list of TaskTypeConfig; the constants below are only the
   defaults seeded into new projects and the fallback used when a project
   hasn't been migrated yet or a view spans multiple projects. */
export type TaskTypeConfig = {
  id: string;
  name: string;
  color: string;
  icon: string; // a lucide-react icon name (see CURATED_TYPE_ICONS)
  system?: boolean; // system types carry hierarchy semantics — cannot be deleted
};

/* `epic` and `subtask` are structural, not cosmetic: an epic is the container
   other tasks link to, and subtasks are the children created under a task. They
   are always present and can be recolored/re-iconed but never removed. */
export const SYSTEM_TASK_TYPE_IDS = ["epic", "subtask"] as const;

/** Default task types seeded into every new project. */
export const DEFAULT_TASK_TYPES: TaskTypeConfig[] = [
  { id: "epic", name: "Epic", color: "#8b5cf6", icon: "Zap", system: true },
  { id: "story", name: "Story", color: "#22c55e", icon: "Bookmark" },
  { id: "task", name: "Task", color: "#3b82f6", icon: "CheckSquare" },
  { id: "bug", name: "Bug", color: "#ef4444", icon: "Bug" },
  { id: "spike", name: "Spike", color: "#f59e0b", icon: "Search" },
  { id: "improvement", name: "Improvement", color: "#06b6d4", icon: "TrendingUp" },
  { id: "subtask", name: "Subtask", color: "#64748b", icon: "GitBranch", system: true },
];

/* lucide-react icon names offered in the project's task-type icon picker. Kept
   as a curated set (not the full ~1000-icon library) so the bundle stays small
   and the picker stays usable. The matching components are registered in
   `src/components/ui.tsx` (TYPE_ICON_REGISTRY) — keep the two in sync. */
export const CURATED_TYPE_ICONS = [
  "CheckSquare", "Bug", "Bookmark", "Zap", "Search", "TrendingUp", "GitBranch",
  "Flag", "Star", "Layers", "Box", "Package", "Rocket", "Target", "Lightbulb",
  "AlertTriangle", "Wrench", "Sparkles", "FileText", "ClipboardList", "FlaskConical",
  "Milestone", "GitPullRequest", "ShieldAlert", "Gauge", "Puzzle", "Palette",
  "Database", "Server", "Globe", "Bell", "Heart", "Code", "Feather", "Compass", "Hammer",
] as const;

const NEUTRAL_TASK_TYPE: TaskTypeConfig = { id: "task", name: "Task", color: "#64748b", icon: "CheckSquare" };

/** Resolve a task's `type` id to its display config. Prefers the project's own
    configured types, falls back to the built-in defaults, then to a neutral
    badge — so a legacy or unknown id never crashes a view. */
export function resolveTaskType(typeId: string, types?: TaskTypeConfig[] | null): TaskTypeConfig {
  const list = types && types.length ? types : DEFAULT_TASK_TYPES;
  return (
    list.find((t) => t.id === typeId) ||
    DEFAULT_TASK_TYPES.find((t) => t.id === typeId) ||
    { ...NEUTRAL_TASK_TYPE, id: typeId, name: typeId }
  );
}

export const PRIORITIES = ["highest", "high", "medium", "low", "lowest"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  highest: { label: "Highest", color: "#ef4444" },
  high: { label: "High", color: "#f97316" },
  medium: { label: "Medium", color: "#eab308" },
  low: { label: "Low", color: "#22c55e" },
  lowest: { label: "Lowest", color: "#3b82f6" },
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

/* ---------------------------- Super admin ----------------------------
   Super-admin status is anchored to ONE designated email — not a mutable DB
   role. Only this account can reach /admin and manage global users. Keeping it
   email-based guarantees exactly one super admin that can't be granted to
   anyone else by editing a role field. The DB `role` is kept in sync for
   display/back-compat (see the register route + migration). */
export const SUPER_ADMIN_EMAIL = "harshksahu11@gmail.com";

/** True if the given email is the designated super admin (case-insensitive). */
export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

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
  { id: "dependencies", label: "Dependencies" },
  { id: "watchers", label: "Watchers" },
] as const;

/* Built-in fields that can be marked "required" (soft) on new tasks. When any are
   set, creating a task via quick-add opens the full modal so they can be filled —
   but the task is always saved even if left blank (never blocks, never errors). */
export const REQUIRABLE_TASK_FIELDS = [
  { id: "description", label: "Description" },
  { id: "assignee", label: "Assignee" },
  { id: "priority", label: "Priority" },
  { id: "dueDate", label: "Due date" },
  { id: "storyPoints", label: "Story points" },
  { id: "epic", label: "Epic" },
  { id: "sprint", label: "Sprint" },
] as const;

/* Custom fields a project can add to its tasks (e.g. an "ETA" date or a
   "Labels" multiselect). A "multiselect" field carries its own options. */
export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "multiselect"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
];
