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
 * The value may be the raw JSON string OR that JSON base64-encoded (handy for
 * hosting dashboards that mangle the multi-line private_key).
 */

import { initializeApp, getApps, getApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Parse the service-account value tolerantly. Hosting dashboards (Vercel, etc.)
 * frequently corrupt the `private_key` newlines, so we accept, in order:
 *   1. plain JSON
 *   2. base64-encoded JSON
 * and then normalize the private_key regardless of how its newlines were stored.
 */
/**
 * A safe, secret-free summary of what the env var actually holds — length and
 * structural hints only, never the contents. Surfaced in the error response so
 * misconfigurations are debuggable without server logs.
 */
export function serviceAccountDiag(): string {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw == null) return "FIREBASE_SERVICE_ACCOUNT: not set";
  const t = raw.trim();
  return [
    `len=${t.length}`,
    `firstChar=${JSON.stringify(t.slice(0, 1))}`,
    `startsWithBrace=${t.startsWith("{")}`,
    `startsWithQuote=${t.startsWith('"')}`,
    `hasEscapedNewline=${t.includes("\\n")}`,
    `hasRealNewline=${/\r|\n/.test(t)}`,
  ].join(", ");
}

function parseServiceAccount(raw: string) {
  const trimmed = raw.trim();
  const attempt = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  // Accept plain JSON first, then base64-encoded JSON.
  let parsed = attempt(trimmed) ?? attempt(Buffer.from(trimmed, "base64").toString("utf8"));
  // Tolerate a double-stringified value (a JSON string wrapping the JSON).
  if (typeof parsed === "string") parsed = attempt(parsed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`could not parse as JSON, base64 JSON, or stringified JSON (${serviceAccountDiag()})`);
  }
  // Turn literal "\n" sequences into real newlines (a no-op if already real).
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  if (!parsed.private_key || !parsed.client_email) {
    throw new Error(`parsed but missing private_key/client_email (${serviceAccountDiag()})`);
  }
  return parsed;
}

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    let sa;
    try {
      sa = parseServiceAccount(raw);
    } catch (e) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT ${(e as Error).message}`);
    }
    try {
      return cert(sa);
    } catch (e) {
      throw new Error(`firebase cert() rejected the service account: ${(e as Error).message}`);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT (service-account JSON) " +
      "or GOOGLE_APPLICATION_CREDENTIALS (path to a key file)."
  );
}

// Initialize lazily on first use rather than at module load, so a missing
// FIREBASE_SERVICE_ACCOUNT surfaces as a clean, caught request-time error
// (logged + JSON) instead of crashing the whole route module with an opaque
// 500 — which is exactly what happened in prod when the env var wasn't set.
let cached: Auth | null = null;

export function getAdminAuth(): Auth {
  if (cached) return cached;
  const app = getApps().length ? getApp() : initializeApp({ credential: loadCredential() });
  cached = getAuth(app);
  return cached;
}
