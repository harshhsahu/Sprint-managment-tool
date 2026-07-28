"use client";

import { useEffect, useState } from "react";
import { useQ, useUpdateMeMutation } from "@/store/hooks";
import { Spinner, Avatar, Button } from "@/components/ui";
import { AVATAR_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Sydney",
];

export default function ProfilePage() {
  const { data } = useQ.useMe();
  const { data: actData } = useQ.useActivity("/api/activity?user=me&limit=25");
  const [updateMe, { isLoading: saving }] = useUpdateMeMutation();
  const me = data?.user;
  const [form, setForm] = useState({ name: "", designation: "", timezone: "UTC", avatarColor: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me) setForm({ name: me.name, designation: me.designation || "", timezone: me.timezone || "UTC", avatarColor: me.avatarColor || "" });
  }, [me]);

  if (!me) return <Spinner label="Loading profile…" />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await updateMe(form).unwrap();
    setMsg("Profile saved");
    setTimeout(() => setMsg(""), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Profile</h1>

      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar user={{ name: form.name || me.name, avatarColor: form.avatarColor }} size={56} />
          <div>
            <div className="font-semibold">{me.name}</div>
            <div className="text-sm text-muted">{me.email}</div>
            <div className="text-xs text-muted capitalize">{me.role.replace("_", " ")}</div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Avatar color</label>
          <div className="flex gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" className={cn("h-7 w-7 rounded-full border-2", form.avatarColor === c ? "border-foreground" : "border-transparent")} style={{ background: c }} onClick={() => setForm({ ...form, avatarColor: c })} />
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Full name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Designation</label>
          <input className="input" placeholder="e.g. Senior QA Engineer" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Timezone</label>
          <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <Button pending={saving}>Save profile</Button>
      </form>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">My recent activity</h2>
        <div className="space-y-2">
          {(actData?.activity || []).map((a: Any) => (
            <div key={a._id} className="text-sm">
              <span className="text-muted">{a.detail}</span>
              <span className="ml-2 text-xs text-muted/70">{a.project?.name ? `· ${a.project.name}` : ""} · {new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {(actData?.activity || []).length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
