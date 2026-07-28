"use client";

import { use, useState } from "react";
import { useQ } from "@/store/hooks";
import { Spinner, Avatar } from "@/components/ui";
import { useProject, ProjectHeader, type Any } from "@/components/project/common";

export default function ActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQ.useActivity(`/api/activity?project=${projectId}&page=${page}&limit=40`);

  if (!project) return <Spinner label="Loading activity…" />;

  return (
    <div className="mx-auto max-w-3xl p-5">
      <ProjectHeader project={project} title="Activity & Audit Log" />
      {isLoading && !data ? (
        <Spinner />
      ) : (
        <div className="card divide-y divide-line">
          {(data?.activity || []).map((a: Any) => (
            <div key={a._id} className="flex items-start gap-3 px-4 py-3">
              <Avatar user={a.user} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{a.user?.name || "Someone"}</span>{" "}
                  <span className="text-muted">{a.detail}</span>
                </p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{a.action}</span> · {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          {(data?.activity || []).length === 0 && <p className="py-10 text-center text-sm text-muted">No activity recorded yet.</p>}
          {data?.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted">
              <span>page {data.page} of {data.pages}</span>
              <span className="flex gap-2">
                <button className="btn-ghost !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <button className="btn-ghost !py-1 text-xs" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
