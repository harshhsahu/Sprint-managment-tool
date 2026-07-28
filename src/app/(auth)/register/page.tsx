"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useRegisterMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";

/** Map Firebase auth error codes to friendly messages. */
function firebaseErr(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/invalid-email":
      return "Please enter a valid email address";
    case "auth/weak-password":
      return "Password is too weak (at least 8 characters)";
    default:
      return errMsg(e);
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", designation: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [register] = useRegisterMutation();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // 1. Create the Firebase user (owns the credential).
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const idToken = await cred.user.getIdToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      try {
        // 2. Create the matching Mongo profile + app session.
        await register({ idToken, name: form.name, designation: form.designation, timezone }).unwrap();
      } catch (serverErr) {
        // Roll back the orphaned Firebase user so the email stays free to retry.
        await cred.user.delete().catch(() => {});
        throw serverErr;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErr(firebaseErr(e));
    } finally {
      setBusy(false);
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
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        OR
        <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleSignInButton
        onError={setErr}
        onDone={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
      <div className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
