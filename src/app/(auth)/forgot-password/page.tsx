"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ resetLink?: string }>("/api/auth/forgot", "POST", { email });
      setSent(true);
      if (res.resetLink) setLink(res.resetLink);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
      <p className="mb-5 text-sm text-muted">Enter your email and we&apos;ll generate a reset link.</p>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p>If an account exists for <b>{email}</b>, a reset link has been generated.</p>
          {link && (
            <p className="rounded-lg border border-line bg-background p-3 break-all">
              <Link className="text-accent hover:underline" href={link}>Open reset link</Link>
            </p>
          )}
          <Link href="/login" className="text-accent hover:underline block">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input className="input" type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Working…" : "Generate reset link"}</button>
          <Link href="/login" className="block text-center text-sm text-accent hover:underline">Back to sign in</Link>
        </form>
      )}
    </div>
  );
}
