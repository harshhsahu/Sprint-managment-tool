"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setErr("Passwords don't match");
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/reset", "POST", { token, password });
      router.push("/login");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h1 className="mb-5 text-lg font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="input" type="password" required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <input className="input" type="password" required minLength={8} placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !token}>{busy ? "Saving…" : "Reset password"}</button>
        {!token && <p className="text-sm text-red-500">Missing reset token — use the link you were given.</p>}
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
