"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useLoginMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";

/** Map Firebase auth error codes to friendly messages. */
function firebaseErr(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password";
    case "auth/invalid-email":
      return "Please enter a valid email address";
    case "auth/user-disabled":
      return "This account has been deactivated";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later";
    default:
      return errMsg(e);
  }
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [login] = useLoginMutation();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // 1. Authenticate against Firebase.
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      // 2. Exchange the Firebase token for our app session cookie.
      await login({ idToken }).unwrap();
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch (e) {
      setErr(firebaseErr(e));
    } finally {
      setBusy(false);
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
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-muted">Password</label>
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">Forgot password?</Link>
          </div>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
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
          router.push(params.get("next") || "/dashboard");
          router.refresh();
        }}
      />
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
