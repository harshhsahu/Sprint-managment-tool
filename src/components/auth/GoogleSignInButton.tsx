"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useLoginMutation } from "@/store/hooks";
import { errMsg } from "@/store/api";

const provider = new GoogleAuthProvider();

/** Map Google popup error codes to friendly messages. */
function googleErr(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user dismissed — don't show an error
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method";
    case "auth/popup-blocked":
      return "Popup blocked. Please allow popups and try again";
    default:
      return errMsg(e);
  }
}

/**
 * "Continue with Google" — signs in via Firebase popup, exchanges the ID token
 * for the app session (auto-provisions a profile on first sign-in), then calls
 * onDone so the page can redirect.
 */
export function GoogleSignInButton({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [login] = useLoginMutation();

  async function click() {
    onError("");
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await login({ idToken }).unwrap();
      onDone();
    } catch (e) {
      const msg = googleErr(e);
      if (msg) onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={click} disabled={busy} className="btn-ghost w-full">

      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {busy ? "Signing in…" : "Continue with Google"}
    </button>
  );
}
