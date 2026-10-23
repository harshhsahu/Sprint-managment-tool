---
covers: ["src/components/TaskModal.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---
# Component: TaskModal

> Clone the pattern for other complex modals.

## Location
`src/components/TaskModal.tsx` (default export).

## Purpose
The single detail/edit surface for a task, opened from board, backlog, list, calendar,
timeline, my-tasks and settings (archived tasks). The board also opens it from
`?task=<id>`. Standardizes inline field editing, description, subtasks, dependencies,
custom fields (incl. inline option creation), watchers, comments with @mentions, activity,
and capability/read-only gating so every view opens the same task experience.

## Props
```tsx
interface TaskModalProps {
  taskId: string;               // task to load (useQ.useTask → GET /api/tasks/[id])
  project: Any;                 // populated project: statuses, taskTypes, customFields,
                                // hiddenFields, requiredFields, members (option lists)
  onClose: () => void;          // close handler (board also clears ?task=)
  onChanged?: () => void;       // called after a mutation so the parent list refetches
}
```
- `taskId` — required; changing it resets the in-modal navigation stack.
- `project` — required; only used for option lists. Task data is fetched by the modal itself.
- `onChanged` — optional; wire to the parent's `mutate` from `useQ`.

## Usage Example
```tsx
import TaskModal from "@/components/TaskModal";

{openTask && (
  <TaskModal
    taskId={openTask}
    project={project}
    onClose={() => setOpenTask(null)}
    onChanged={() => mutate()}
  />
)}
```

## Variants / States
- **Loading:** `<Spinner />` while `GET /api/tasks/[id]` resolves; header shows "Task".
- **Header:** type icon, key, epic chip, Back button (when drilled into a subtask/parent),
  and **Copy link** — copies `${origin}/p/<projectId>/board?task=<currentId>` via
  `navigator.clipboard`, shows "Copied" for 1.5 s, falls back to `window.prompt` if the
  clipboard API is blocked. The link always targets the **board** (the only view that reads `?task=`).
- **In-modal navigation:** clicking a subtask or "Parent" swaps `currentId` and pushes the
  previous id on `navStack`; deleting a drilled-into task returns to the previous one.
- **Capability-gated:** from the GET response's `myCapabilities` (not the parent's):
  `task:edit` → all selects/inputs enabled, Duplicate/Archive, subtask form, option creation;
  `task:delete` → Delete; `task:comment` → comment composer. Never gate on role name.
- **Read-only workspace:** GET returns `readOnly: true` when the plan/trial expired; capabilities
  are already only `project:view`, so fields are disabled and the comment area shows
  "This workspace's trial/plan has expired — it is read-only, so commenting is disabled."
  Otherwise a viewer sees "You have view-only access here — commenting is disabled."
- **Project field config:** `hiddenFields` hide fields; `requiredFields` list missing
  required values (`REQUIRABLE_TASK_FIELDS`).
- **Inline custom-field option:** "+" on a multiselect field calls
  `POST /api/projects/[id]/field-options` (needs `task:edit`), applies the option, and
  invalidates `{Project, id}`. (Labels are a multiselect custom field since `f44a142`;
  there is no labels endpoint.)

## Notes
- Field edits go through `updateTask` (optimistic on `getTask`); reference fields
  (assignee, sprint, epic, watchers, dependencies) appear only after the refetch.
- `patch()` has no `try/catch`: a rejected edit rolls back silently and surfaces only as an
  unhandled promise rejection — the user gets no message. Option creation uses `alert(errMsg(e))`.
- Delete uses `confirm()`; subtasks and comments are deleted with the task.
- Accessibility: built on `Modal` — Escape and backdrop mousedown close it; no focus trap.
