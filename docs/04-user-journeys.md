# 04 User Journeys

## Journey: First workspace → first sprint
**Persona:** Workspace Admin · **Trigger:** just registered · **Outcome:** an active sprint with tasks

1. Register (first-ever account becomes `super_admin`); land on the dashboard.
2. Create a workspace, then a project (choose a **key**, e.g. `CC` → tasks become `CC-1`, `CC-2`).
3. Create tasks in the backlog; estimate story points.
4. Create a sprint, drag tasks into it, set capacity.
5. Start the sprint → tasks appear on the board; team begins work.

**Edge cases:** empty workspace (prompt to create a project); project key collision within a workspace (409).

## Journey: Developer works a task
**Persona:** Developer · **Trigger:** assigned a task · **Outcome:** task moved to Done

1. Open notification / My Tasks → open the task.
2. Move it across the board (drag), or change status inline; add a comment with `@email` mention.
3. On reaching a "done"-category status, `completedAt` is stamped and watchers are notified.

**Edge cases:** blocked-by dependency present; WIP limit exceeded (column flagged, not blocked).

## Journey: Team Lead runs the sprint
**Persona:** Team Lead · **Trigger:** sprint end date · **Outcome:** sprint completed, report available

1. Open Backlog & Sprints → **Complete** the active sprint.
2. Choose where incomplete tasks go (backlog or another sprint).
3. Committed/completed points are snapshotted; velocity + burndown update in Reports.

**Edge cases:** completing with no active sprint (blocked); incomplete tasks default to backlog.

## Journey: Admin adds a teammate
**Persona:** Workspace Admin · **Trigger:** new hire · **Outcome:** teammate can work across the workspace

1. Invite by email in the workspace members modal (user must already have an account).
2. Invitee is auto-added to **all** projects in the workspace (admins as `project_admin`, members as `developer`).
3. Optionally define a **custom role** (capability matrix) and assign it in project settings.

**Edge cases:** email not found (asks them to register first); already a member (409).
