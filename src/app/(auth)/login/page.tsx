"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLoginMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [login, { isLoading: busy }] = useLoginMutation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login({ email, password }).unwrap();
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold">Welcome back</h1>
      <p className="mb-5 text-sm text-muted">Sign in to your account</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Password</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent hover:underline">Create account</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
