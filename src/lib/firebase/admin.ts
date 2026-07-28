/**
 * Firebase Admin SDK — server-side token verification.
 *
 * Used by the auth route handlers to verify the ID token a client obtains from
 * Firebase after signing in. Runs in the Node.js runtime only (never in edge
 * middleware). The credential is loaded, in order of preference, from:
 *   1. FIREBASE_SERVICE_ACCOUNT   — the service-account JSON as a single string
 *   2. GOOGLE_APPLICATION_CREDENTIALS / application default credentials
 *
 * Generate the key in Firebase Console → Project settings → Service accounts →
 * "Generate new private key", then paste the JSON into FIREBASE_SERVICE_ACCOUNT.
 */

import { initializeApp, getApps, getApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON");
    }
    // Support keys pasted with escaped newlines in the private_key field.
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return cert(parsed);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT (service-account JSON) " +
      "or GOOGLE_APPLICATION_CREDENTIALS (path to a key file)."
  );
}

const app: App = getApps().length ? getApp() : initializeApp({ credential: loadCredential() });

export const adminAuth = getAuth(app);
