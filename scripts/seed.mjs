/* Seed script: creates demo users, a workspace, a project, sprints and tasks.
   Run with: npm run seed  (drops nothing; skips if demo user already exists) */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprint-management";

const { Schema } = mongoose;
const loose = { strict: false, timestamps: true };
const User = mongoose.model("User", new Schema({}, loose));
const Workspace = mongoose.model("Workspace", new Schema({}, loose));
const Project = mongoose.model("Project", new Schema({}, loose));
const Sprint = mongoose.model("Sprint", new Schema({}, loose));
const Task = mongoose.model("Task", new Schema({}, loose));
const Comment = mongoose.model("Comment", new Schema({}, loose));
const Activity = mongoose.model("Activity", new Schema({}, loose));

const STATUSES = [
  { id: "backlog", name: "Backlog", color: "#64748b", category: "todo", order: 0, wipLimit: 0 },
  { id: "todo", name: "To Do", color: "#3b82f6", category: "todo", order: 1, wipLimit: 0 },
  { id: "in_progress", name: "In Progress", color: "#eab308", category: "in_progress", order: 2, wipLimit: 5 },
  { id: "in_review", name: "In Review", color: "#8b5cf6", category: "in_progress", order: 3, wipLimit: 3 },
  { id: "done", name: "Done", color: "#22c55e", category: "done", order: 4, wipLimit: 0 },
];

const day = (n) => new Date(Date.now() + n * 24 * 3600 * 1000);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to", MONGODB_URI);

  if (await User.findOne({ email: "alice@demo.dev" })) {
    console.log("Demo data already present — nothing to do. Login: alice@demo.dev / password123");
    return mongoose.disconnect();
  }

  const hash = await bcrypt.hash("password123", 10);
  const mk = (name, email, role, designation, color) => ({
    name, email, passwordHash: hash, role, designation, timezone: "Asia/Kolkata", avatarColor: color, active: true,
  });

  const [alice, bob, carol, dave, erin] = await User.create([
    mk("Alice Sharma", "alice@demo.dev", "super_admin", "Engineering Manager", "#8b5cf6"),
    mk("Bob Verma", "bob@demo.dev", "member", "Senior Developer", "#3b82f6"),
    mk("Carol Iyer", "carol@demo.dev", "member", "QA Lead", "#22c55e"),
    mk("Dave Patel", "dave@demo.dev", "member", "Frontend Developer", "#f97316"),
    mk("Erin D'Souza", "erin@demo.dev", "member", "Product Designer", "#ec4899"),
  ]);

  const ws = await Workspace.create({
    name: "NeevCloud Engineering",
    description: "Product & platform engineering teams",
    owner: alice._id,
    members: [
      { user: alice._id, role: "owner" },
      { user: bob._id, role: "admin" },
      { user: carol._id, role: "editor" },
      { user: dave._id, role: "editor" },
      { user: erin._id, role: "viewer" },
    ],
  });

  const project = await Project.create({
    workspace: ws._id,
    name: "Cloud Console",
    key: "CC",
    description: "Next-gen self-service cloud console",
    lead: alice._id,
    // No project members: everyone in the workspace already has access. `members`
    // holds only project guests (users outside the workspace).
    members: [],
    statuses: STATUSES,
    labels: [
      { id: "frontend", name: "Frontend", color: "#3b82f6" },
      { id: "backend", name: "Backend", color: "#8b5cf6" },
      { id: "design", name: "Design", color: "#ec4899" },
      { id: "infra", name: "Infra", color: "#f59e0b" },
    ],
    taskCounter: 0,
    archived: false,
  });

  const [sprintDone, sprintActive, sprintNext] = await Sprint.create([
    {
      project: project._id, name: "Sprint 1", goal: "Foundation: auth & billing skeleton",
      status: "completed", startDate: day(-28), endDate: day(-14), capacity: 30,
      committedPoints: 26, completedPoints: 21, completedAt: day(-14),
    },
    {
      project: project._id, name: "Sprint 2", goal: "Ship the instances dashboard MVP",
      status: "active", startDate: day(-7), endDate: day(7), capacity: 30, committedPoints: 24,
    },
    { project: project._id, name: "Sprint 3", goal: "Networking & volumes", status: "planned", capacity: 30 },
  ]);

  let counter = 0;
  const t = (title, opts = {}) => {
    counter += 1;
    const base = {
      project: project._id, key: `CC-${counter}`, title,
      description: opts.description || "",
      type: opts.type || "task", status: opts.status || "backlog",
      priority: opts.priority || "medium",
      assignee: opts.assignee || null, reporter: opts.reporter || alice._id,
      sprint: opts.sprint || null, epic: opts.epic || null, parentTask: opts.parentTask || null,
      storyPoints: opts.points ?? null, labels: opts.labels || [],
      dueDate: opts.due || null, watchers: [opts.reporter || alice._id, ...(opts.assignee ? [opts.assignee] : [])],
      dependencies: opts.deps || [], order: counter * 1000, archived: false,
      completedAt: opts.completedAt || null, startedAt: opts.startedAt || null,
      createdAt: opts.createdAt || day(-30 + counter),
    };
    return base;
  };

  // epics
  const epics = await Task.create([
    t("Compute: instance lifecycle management", { type: "epic", priority: "high", status: "in_progress", due: day(30) }),
    t("Billing & usage metering", { type: "epic", priority: "high", status: "todo", due: day(45) }),
    t("Networking: VPC self-service", { type: "epic", priority: "medium", status: "backlog", due: day(60) }),
  ]);

  const done = (n) => ({ status: "done", completedAt: day(-n), startedAt: day(-n - 3) });

  const tasks = await Task.create([
    // sprint 1 (completed)
    t("Set up OAuth login with SSO providers", { type: "story", points: 5, assignee: bob._id, sprint: sprintDone._id, labels: ["backend"], ...done(16) }),
    t("Design system tokens & base components", { type: "task", points: 3, assignee: erin._id, reporter: erin._id, sprint: sprintDone._id, labels: ["design", "frontend"], ...done(18) }),
    t("Billing account data model", { type: "story", points: 8, assignee: bob._id, sprint: sprintDone._id, epic: epics[1]._id, labels: ["backend"], ...done(15) }),
    t("Login page pixel polish", { type: "improvement", points: 2, assignee: dave._id, sprint: sprintDone._id, labels: ["frontend"], ...done(14) }),
    t("Fix session cookie expiry on Safari", { type: "bug", points: 3, priority: "high", assignee: bob._id, reporter: carol._id, sprint: sprintDone._id, ...done(14) }),

    // sprint 2 (active)
    t("Instances list with live status", {
      type: "story", points: 5, priority: "high", assignee: dave._id, sprint: sprintActive._id, epic: epics[0]._id,
      labels: ["frontend"], ...done(2),
      description: "Table of instances with state badges, region, flavor and quick actions.",
    }),
    t("Start/stop/reboot instance actions", {
      type: "story", points: 5, priority: "highest", assignee: bob._id, sprint: sprintActive._id, epic: epics[0]._id,
      labels: ["backend"], status: "in_review", startedAt: day(-4), due: day(2),
    }),
    t("Instance detail page", {
      type: "story", points: 3, assignee: dave._id, sprint: sprintActive._id, epic: epics[0]._id,
      labels: ["frontend"], status: "in_progress", startedAt: day(-2), due: day(4),
    }),
    t("E2E tests for instance lifecycle", {
      type: "task", points: 3, assignee: carol._id, reporter: carol._id, sprint: sprintActive._id, epic: epics[0]._id,
      status: "todo", due: day(5),
    }),
    t("Console crashes when instance has no IP", {
      type: "bug", points: 2, priority: "highest", assignee: dave._id, reporter: carol._id, sprint: sprintActive._id,
      epic: epics[0]._id, status: "in_progress", startedAt: day(-1), due: day(1),
      description: "Steps: create instance without network → open detail page → TypeError.",
    }),
    t("Spike: websocket vs polling for status updates", {
      type: "spike", points: 2, assignee: bob._id, sprint: sprintActive._id, status: "todo", due: day(3),
    }),
    t("Empty states for instances dashboard", {
      type: "improvement", points: 1, assignee: erin._id, reporter: erin._id, sprint: sprintActive._id,
      labels: ["design"], status: "todo",
    }),

    // sprint 3 (planned)
    t("VPC create wizard", { type: "story", points: 8, assignee: null, sprint: sprintNext._id, epic: epics[2]._id, labels: ["frontend", "backend"] }),
    t("Security groups CRUD", { type: "story", points: 5, sprint: sprintNext._id, epic: epics[2]._id, labels: ["backend"] }),

    // backlog
    t("Usage dashboard with cost breakdown", { type: "story", points: 8, epic: epics[1]._id, priority: "high", labels: ["frontend"] }),
    t("Invoice PDF export", { type: "task", points: 3, epic: epics[1]._id, labels: ["backend"] }),
    t("Budget alerts & notifications", { type: "story", points: 5, epic: epics[1]._id, priority: "low" }),
    t("Dark mode contrast audit", { type: "improvement", points: 2, reporter: erin._id, labels: ["design"], priority: "lowest" }),
    t("Rate limiting on public API", { type: "task", points: 5, priority: "high", labels: ["backend", "infra"], due: day(10) }),
    t("Flaky test: billing_spec timeout", { type: "bug", points: 1, reporter: carol._id, priority: "low" }),
  ]);

  // one dependency + subtasks
  const detail = tasks.find((x) => x.title === "Instance detail page");
  const actions = tasks.find((x) => x.title === "Start/stop/reboot instance actions");
  await Task.updateOne({ _id: detail._id }, { $set: { dependencies: [actions._id] } });
  counter += 1;
  await Task.create([
    { ...t("Wire up reboot confirmation modal", { type: "subtask", parentTask: actions._id, assignee: dave._id, sprint: sprintActive._id, status: "done", completedAt: day(-1) }), key: `CC-${counter}` },
  ]);
  await Project.updateOne({ _id: project._id }, { $set: { taskCounter: counter } });

  await Comment.create([
    { task: actions._id, author: carol._id, body: "Tested stop/start on staging — reboot still returns 500 for suspended instances." },
    { task: actions._id, author: bob._id, body: "Good catch, handling the suspended state now. Should be in review by EOD." },
  ]);

  await Activity.create([
    { project: project._id, workspace: ws._id, user: alice._id, action: "project.created", detail: 'Created project "Cloud Console" (CC)' },
    { project: project._id, sprint: sprintActive._id, user: alice._id, action: "sprint.started", detail: 'Started sprint "Sprint 2"' },
    { project: project._id, task: actions._id, user: bob._id, action: "task.updated", detail: "CC-7: status: In Progress → In Review" },
  ]);

  console.log("Seeded ✔");
  console.log("Login accounts (password for all: password123):");
  console.log("  alice@demo.dev  — Workspace Owner (+ global Super Admin)");
  console.log("  bob@demo.dev    — Workspace Admin");
  console.log("  carol@demo.dev  — Workspace Editor");
  console.log("  dave@demo.dev   — Workspace Editor");
  console.log("  erin@demo.dev   — Workspace Viewer");
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
