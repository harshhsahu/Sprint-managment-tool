"use client";

import { useMemo } from "react";
import { CheckCircle2, PlusCircle, GitCommitHorizontal } from "lucide-react";
import { useQ } from "@/store/hooks";
import { Modal, Spinner, Avatar, TypeIcon, PriorityBadge } from "@/components/ui";
import type { Any } from "@/components/project/common";

/**
 * Focused "user story" of a done task: who created it, every status
 * transition and who made it, ending with who moved it to Done. Built
 * entirely from the task's existing Activity log (no new tracking).
 */
export default function TaskJourneyModal({
  taskId,
  project,
  onClose,
}: {
  taskId: string;
  project: Any;
  onClose: () => void;
}) {
  const { data, isLoading } = useQ.useTask(taskId);
  const task = data?.task;

  const doneNames: string[] = useMemo(
    () => (project?.statuses || []).filter((s: Any) => s.category === "done").map((s: Any) => s.name),
    [project]
  );

  // Activity arrives newest-first; the journey reads oldest-first. The
  // synthesized "created" row below already covers creation, so drop the
  // logged `task.created` entry to avoid showing it twice.
  const timeline: Any[] = useMemo(
    () => [...(data?.activity || [])].filter((a: Any) => a.action !== "task.created").reverse(),
    [data]
  );

  // The person who moved it to Done = author of the most recent activity whose
  // detail mentions a done-category status ("… → Done").
  const doneEvent = useMemo(() => {
    if (!doneNames.length) return null;
    const acts = data?.activity || []; // newest-first
    return (
      acts.find((a: Any) =>
        doneNames.some((n: string) => typeof a.detail === "string" && a.detail.includes(`→ ${n}`))
      ) || null
    );
  }, [data, doneNames]);

  const leadDays =
    task?.completedAt && task?.createdAt
      ? Math.max(
          0,
          Math.round((+new Date(task.completedAt) - +new Date(task.createdAt)) / 86400000)
        )
      : null;

  return (
    <Modal open onClose={onClose} title="Task journey" wide>
      {isLoading && !task ? (
        <Spinner label="Loading journey…" />
      ) : !task ? (
        <p className="py-8 text-center text-sm text-muted">Task not found.</p>
      ) : (
        <div className="space-y-4">
          {/* header */}
          <div className="flex items-start gap-2">
            <TypeIcon type={task.type} types={project?.taskTypes} size={16} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">{task.key}</span>
                <PriorityBadge priority={task.priority} compact />
              </div>
              <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
            </div>
          </div>

          {/* summary badges */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Created by"
              user={task.reporter}
              date={task.createdAt}
            />
            <SummaryCard
              label="Moved to Done by"
              user={doneEvent?.user || task.assignee}
              date={task.completedAt}
              accent
            />
            <div className="card p-2.5">
              <div className="text-[11px] text-muted">Lead time</div>
              <div className="text-lg font-bold">{leadDays != null ? `${leadDays}d` : "—"}</div>
              <div className="text-[11px] text-muted">created → done</div>
            </div>
          </div>

          {/* timeline */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted">Activity</div>
            <ol className="relative space-y-3 border-l border-line pl-4">
              <TimelineRow
                icon={<PlusCircle size={13} className="text-accent" />}
                user={task.reporter}
                text="created this task"
                date={task.createdAt}
              />
              {timeline.map((a: Any) => {
                const isDone = doneNames.some(
                  (n: string) => typeof a.detail === "string" && a.detail.includes(`→ ${n}`)
                );
                return (
                  <TimelineRow
                    key={a._id}
                    icon={
                      isDone ? (
                        <CheckCircle2 size={13} className="text-green-500" />
                      ) : (
                        <GitCommitHorizontal size={13} className="text-muted" />
                      )
                    }
                    user={a.user}
                    text={stripKey(a.detail, task.key)}
                    date={a.createdAt}
                    highlight={isDone}
                  />
                );
              })}
              {timeline.length === 0 && (
                <li className="text-xs text-muted">No further activity recorded.</li>
              )}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SummaryCard({
  label,
  user,
  date,
  accent,
}: {
  label: string;
  user: Any;
  date?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card p-2.5 ${accent ? "border-green-500/40" : ""}`}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {user ? <Avatar user={user} size={20} /> : null}
        <span className="truncate text-sm font-medium">{user?.name || "—"}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted">
        {date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  user,
  text,
  date,
  highlight,
}: {
  icon: React.ReactNode;
  user: Any;
  text: string;
  date: string;
  highlight?: boolean;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card">
        {icon}
      </span>
      <div className={`flex items-start gap-2 text-xs ${highlight ? "font-medium" : ""}`}>
        <Avatar user={user} size={20} />
        <div className="min-w-0">
          <span className="font-medium">{user?.name || "Someone"}</span>{" "}
          <span className="text-muted">{text}</span>
          <div className="text-muted/70">{new Date(date).toLocaleString()}</div>
        </div>
      </div>
    </li>
  );
}

/** Activity details are prefixed with the task key ("PROJ-42: …"); drop it here. */
function stripKey(detail: unknown, key: string): string {
  if (typeof detail !== "string") return "updated this task";
  return detail.replace(new RegExp(`^${key}:\\s*`), "");
}
