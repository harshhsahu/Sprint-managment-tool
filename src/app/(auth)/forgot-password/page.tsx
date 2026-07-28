"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { errMsg } from "@/store/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Always show success — never reveal whether an account exists.
      setSent(true);
    } catch (e) {
      const code = (e as { code?: string })?.code || "";
      // Treat "no such user" as success too, to avoid account enumeration.
      if (code === "auth/user-not-found") {
        setSent(true);
      } else if (code === "auth/invalid-email") {
        setErr("Please enter a valid email address");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many attempts. Please try again later");
      } else {
        setErr(errMsg(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6">
        <h1 className="mb-1 text-lg font-semibold">Check your email</h1>
        <p className="mb-5 text-sm text-muted">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent a
          link to reset your password. It may take a few minutes to arrive.
        </p>
        <Link href="/login" className="btn-primary w-full">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
      <p className="mb-5 text-sm text-muted">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-accent hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
