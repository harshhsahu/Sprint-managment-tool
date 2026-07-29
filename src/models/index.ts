import mongoose, { Schema, model, models, Types } from "mongoose";

/* ------------------------------ User ------------------------------ */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Firebase Auth is the identity provider. UID links this doc to the Firebase user.
    firebaseUid: { type: String, index: true, sparse: true },
    // Legacy bcrypt hash — no longer required now that Firebase owns credentials.
    // Kept so the migration can import existing passwords into Firebase.
    passwordHash: { type: String, required: false },
    role: { type: String, enum: ["super_admin", "member"], default: "member" },
    designation: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    avatarColor: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ---------------------------- Workspace --------------------------- */
const WorkspaceMemberSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    // owner/admin/editor/viewer — applies to every project in the workspace.
    role: { type: String, enum: ["owner", "admin", "editor", "viewer"], default: "editor" },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: Types.ObjectId, ref: "User", required: true },
    members: [WorkspaceMemberSchema],
    // ---- Billing / subscription (see src/lib/plans.ts) ----
    // Assigned by the super admin from the admin panel; no payment gateway yet.
    // New workspaces start on the Pro plan in a 15-day trial (status "trialing").
    plan: { type: String, enum: ["trial", "pro", "business", "enterprise"], default: "pro" },
    subscriptionStatus: { type: String, enum: ["trialing", "active", "expired"], default: "trialing" },
    // 15-day trial (TRIAL_DAYS). Set on creation; when it lapses the workspace goes read-only.
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
    // When a paid plan lapses. null = no expiry (does not lapse).
    planExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ----------------------------- Project ---------------------------- */
// Project members here are GUESTS — users who are NOT workspace members but have
// access to this single project. Workspace members get access automatically and
// are NOT stored here. Role: admin/editor/viewer.
const ProjectMemberSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "editor", "viewer"], default: "editor" },
  },
  { _id: false }
);

const StatusSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: "#64748b" },
    category: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    order: { type: Number, default: 0 },
    wipLimit: { type: Number, default: 0 }, // 0 = no limit
  },
  { _id: false }
);

// A project-defined task type (epic/story/bug/…). Configurable per project, with
// its own colour + lucide icon name. `system` types (epic, subtask) carry
// hierarchy semantics and cannot be deleted — see src/lib/constants.ts.
const TaskTypeSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: "#3b82f6" },
    icon: { type: String, default: "CheckSquare" },
    system: { type: Boolean, default: false },
  },
  { _id: false }
);

// A selectable option for a "multiselect" custom field (carries its own colour,
// so its chips render exactly like the old built-in labels did).
const CustomFieldOptionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: "#3b82f6" },
  },
  { _id: false }
);

// A project-defined custom task field (e.g. an "ETA" date, or a "Labels" multiselect).
const CustomFieldSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "date", "multiselect"], default: "text" },
    // Only meaningful for type "multiselect" — the choosable options.
    options: { type: [CustomFieldOptionSchema], default: undefined },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    workspace: { type: Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    lead: { type: Types.ObjectId, ref: "User" },
    members: [ProjectMemberSchema],
    // Workspace members who have been explicitly removed from THIS project. They keep
    // their workspace role everywhere else but lose all access here (revertable).
    excludedMembers: [{ type: Types.ObjectId, ref: "User" }],
    statuses: [StatusSchema],
    // Per-project task types (epic/story/bug/…). Seeded from DEFAULT_TASK_TYPES on
    // creation; back-filled for existing projects by migration.
    taskTypes: [TaskTypeSchema],
    // Task-field configuration: hide built-in optional fields + define custom ones.
    hiddenFields: [{ type: String }],
    // Fields that new tasks are prompted to fill (soft-required — never block saving).
    requiredFields: [{ type: String }],
    customFields: [CustomFieldSchema],
    taskCounter: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);
ProjectSchema.index({ workspace: 1, key: 1 }, { unique: true });

/* ----------------------------- Sprint ----------------------------- */
const SprintSchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true },
    goal: { type: String, default: "" },
    status: { type: String, enum: ["planned", "active", "completed", "archived"], default: "planned" },
    startDate: { type: Date },
    endDate: { type: Date },
    capacity: { type: Number, default: 0 }, // story points the team can take
    completedAt: { type: Date },
    // snapshot metrics captured on completion
    committedPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ------------------------------ Task ------------------------------ */
const TaskSchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    key: { type: String, required: true, index: true }, // e.g. PROJ-42
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" }, // rich text (HTML)
    // A task type id defined by the project's `taskTypes`. Not a fixed enum — types
    // are configurable per project; validity is enforced at the API layer.
    type: { type: String, default: "task" },
    status: { type: String, default: "backlog", index: true },
    priority: {
      type: String,
      enum: ["highest", "high", "medium", "low", "lowest"],
      default: "medium",
      index: true,
    },
    assignee: { type: Types.ObjectId, ref: "User", default: null, index: true },
    reporter: { type: Types.ObjectId, ref: "User", required: true },
    sprint: { type: Types.ObjectId, ref: "Sprint", default: null, index: true },
    epic: { type: Types.ObjectId, ref: "Task", default: null }, // parent epic
    parentTask: { type: Types.ObjectId, ref: "Task", default: null }, // for subtasks
    storyPoints: { type: Number, default: null },
    dueDate: { type: Date, default: null },
    customFields: { type: Schema.Types.Mixed, default: {} }, // { [fieldId]: value } per project.customFields
    watchers: [{ type: Types.ObjectId, ref: "User" }],
    dependencies: [{ type: Types.ObjectId, ref: "Task" }], // blocked by
    order: { type: Number, default: 0 }, // position within status column / backlog
    archived: { type: Boolean, default: false, index: true },
    completedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        uploadedBy: { type: Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
TaskSchema.index({ project: 1, key: 1 }, { unique: true });
TaskSchema.index({ title: "text", description: "text", key: "text" });

/* ----------------------------- Comment ---------------------------- */
const CommentSchema = new Schema(
  {
    task: { type: Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    mentions: [{ type: Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

/* ----------------------------- Activity --------------------------- */
const ActivitySchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: "Project", index: true },
    workspace: { type: Types.ObjectId, ref: "Workspace", index: true },
    task: { type: Types.ObjectId, ref: "Task", index: true, default: null },
    sprint: { type: Types.ObjectId, ref: "Sprint", default: null },
    user: { type: Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. task.created, task.status_changed
    detail: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
ActivitySchema.index({ createdAt: -1 });

/* --------------------------- Notification ------------------------- */
const NotificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["assignment", "mention", "comment", "status_change", "sprint", "due_date", "invite"],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
    actor: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/* --------------------------- SavedFilter -------------------------- */
const SavedFilterSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    project: { type: Types.ObjectId, ref: "Project", default: null },
    name: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/* ----------------------------- Invite ----------------------------- */
// A pending invitation for someone to join a project as a guest. The invitee is
// identified by email so people who don't have an account yet can be invited;
// the invite surfaces (and can be accepted/rejected) once they sign in with that
// email. Accepting adds them to project.members at `role`.
const InviteSchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["admin", "editor", "viewer"], default: "editor" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
    invitedBy: { type: Types.ObjectId, ref: "User", required: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ---------------------------- Dashboard --------------------------- */
const DashboardSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    widgets: [
      new Schema(
        {
          id: String,
          // assigned_to_me | sprint_progress | recent_activity | by_status | by_priority | by_assignee | open_vs_closed | upcoming_deadlines | team_workload
          type: { type: String },
          w: { type: Number, default: 1 }, // grid width units (1-2)
          project: { type: Types.ObjectId, ref: "Project", default: null },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

/**
 * Register (or reuse) a Mongoose model.
 *
 * Mongoose caches compiled models on its module-global `mongoose.models`
 * registry. The classic `models.X || model("X", schema)` pattern reuses that
 * cache — which is required in production (and to avoid OverwriteModelError),
 * but in development it means schema edits DON'T take effect on hot-reload: the
 * stale model keeps its old paths, and strict mode then SILENTLY STRIPS any new
 * field from writes (findByIdAndUpdate `$set`), so updates appear to "succeed"
 * while the new field never persists.
 *
 * So in development we drop the cached model and recompile it, letting Fast
 * Refresh pick up `src/models` changes without a manual server restart. In
 * production we keep the cache.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defineModel<T = any>(name: string, schema: Schema): mongoose.Model<T> {
  if (process.env.NODE_ENV !== "production" && models[name]) {
    mongoose.deleteModel(name);
  }
  return (models[name] as mongoose.Model<T>) || model<T>(name, schema);
}

export const User = defineModel("User", UserSchema);
export const Workspace = defineModel("Workspace", WorkspaceSchema);
export const Project = defineModel("Project", ProjectSchema);
export const Sprint = defineModel("Sprint", SprintSchema);
export const Task = defineModel("Task", TaskSchema);
export const Comment = defineModel("Comment", CommentSchema);
export const Activity = defineModel("Activity", ActivitySchema);
export const Notification = defineModel("Notification", NotificationSchema);
export const SavedFilter = defineModel("SavedFilter", SavedFilterSchema);
export const Invite = defineModel("Invite", InviteSchema);
export const Dashboard = defineModel("Dashboard", DashboardSchema);

export { mongoose };
