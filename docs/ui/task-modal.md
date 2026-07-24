# Component: TaskModal

> Clone the pattern for other complex modals.

## Location
`src/components/TaskModal.tsx`

## Purpose
The single detail/edit surface for a task, opened from any project view (and deep-linked via
`?task=<id>`). Standardizes inline editing, comments, subtasks, dependencies, labels, and
capability-gated actions so every view opens the same task experience.

## Props
```tsx
interface TaskModalProps {
  taskId: string;               // the task to load (SWR: GET /api/tasks/[id])
  project: Any;                 // populated project (statuses, labels, members) for pickers
  onClose: () => void;          // close handler (also clears ?task= on project views)
  onChanged?: () => void;       // called after a mutation so the parent list revalidates
}
```
- `taskId` — required; drives the fetch.
- `project` — required; supplies status/label/member/sprint/epic options.
- `onChanged` — optional; wire to the parent's SWR `mutate`.

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
- **Loading:** spinner while `GET /api/tasks/[id]` resolves.
- **Capability-gated:** fields/actions render read-only or hidden based on `myCapabilities`
  (`task:edit`, `task:comment`, `task:delete`). Never gate on role name.
- **Inline label creation:** the "+ Label" control creates a project label
  (`POST /api/projects/[id]/labels`, requires `task:edit`) and applies it.

## Notes
- The modal fetches its own task data; the `project` prop is only for option lists — keep it
  populated (the parent views already guard on `project`).
- Actions call `api()` then `mutate()`; the parent stays in sync via `onChanged`.
- Accessibility: closes on Escape and backdrop click; keep focusable controls reachable.
