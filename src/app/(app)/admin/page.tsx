"use client";

import useSWR from "swr";
import { fetcher, api } from "@/lib/client";
import { Spinner, Avatar } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export default function AdminPage() {
  const { me } = useApp();
  const { data, mutate } = useSWR<Any>("/api/users?all=1", fetcher);

  if (!me) return <Spinner />;
  if (me.role !== "super_admin") {
    return <p className="p-10 text-center text-sm text-muted">Only super admins can access user administration.</p>;
  }

  async function patch(id: string, set: Any) {
    try {
      await api(`/api/users/${id}`, "PATCH", set);
      mutate();
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-xl font-bold">User administration</h1>
      <p className="mb-5 text-sm text-muted">Activate/deactivate accounts and manage global roles. New users register themselves at <span className="font-mono">/register</span>.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Designation</th>
              <th className="px-4 py-2">Global role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((u: Any) => (
              <tr key={u._id} className={cn("border-b border-line", !u.active && "opacity-60")}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <Avatar user={u} size={26} />
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{u.designation || "—"}</td>
                <td className="px-4 py-2">
                  <select
                    className="rounded border border-line bg-card px-2 py-1 text-xs"
                    value={u.role}
                    disabled={u._id === me._id}
                    onChange={(e) => patch(u._id, { role: e.target.value })}
                  >
                    <option value="member">Member</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button
                    className={cn("chip cursor-pointer", u.active ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-500")}
                    disabled={u._id === me._id}
                    onClick={() => patch(u._id, { active: !u.active })}
                    title={u.active ? "Click to deactivate" : "Click to activate"}
                  >
                    {u.active ? "Active" : "Deactivated"}
                  </button>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
