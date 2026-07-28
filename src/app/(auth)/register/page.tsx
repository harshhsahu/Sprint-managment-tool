"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRegisterMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", designation: "" });
  const [err, setErr] = useState("");
  const [register, { isLoading: busy }] = useRegisterMutation();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await register(form).unwrap();
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold">Create your account</h1>
      <p className="mb-5 text-sm text-muted">The first account becomes the super admin.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Full name</label>
          <input className="input" required minLength={2} value={form.name} onChange={set("name")} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input className="input" type="email" required value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Designation (optional)</label>
          <input className="input" placeholder="e.g. Frontend Engineer" value={form.designation} onChange={set("designation")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Password</label>
          <input className="input" type="password" required minLength={8} value={form.password} onChange={set("password")} />
          <p className="mt-1 text-xs text-muted">At least 8 characters</p>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
