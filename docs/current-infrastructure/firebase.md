---
covers: ["src/lib/firebase/**", "src/app/api/auth/login/route.ts", "src/app/api/auth/register/route.ts", "src/components/auth/GoogleSignInButton.tsx", "src/app/(auth)/**", "src/components/AppShell.tsx"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# Firebase

> Identity provider only: Firebase Auth owns credentials (email/password, Google, password reset). Kanbo's own `sm_session` JWT owns the session.

> [!WARNING]
> Firebase users and Mongo `users` are two stores linked by `User.firebaseUid` (with email as fallback). Creating a Mongo user (e.g. `scripts/seed.mjs`) does **not** create a Firebase login, and deleting a Firebase user does not touch Mongo. Nothing in the app reads the Firebase session after login — middleware and APIs trust only `sm_session`.

## Role
- Verifies who the user is; Kanbo then mints its own session (`src/lib/auth.ts:signSession`).
- Not used for data, storage, messaging or analytics. Only `firebase/app`, `firebase/auth`, `firebase-admin/app` and `firebase-admin/auth` are imported.
- Introduced in `79ab40a` (replacing app-managed bcrypt passwords); `User.passwordHash` remains for importing old passwords into Firebase.

## Connection
- **Env var(s):** client `NEXT_PUBLIC_FIREBASE_*` (7 vars, all with hard-coded fallbacks for the `wowdev` project); server `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS`. Full table: [../15-environment-setup.md](../15-environment-setup.md#environment-variables).
- **Client:** `src/lib/firebase/client.ts` (`"use client"`) exports `auth`; initialises once via `getApps().length ? getApp() : initializeApp(...)` to survive Fast Refresh.
- **Server:** `src/lib/firebase/admin.ts:getAdminAuth` — lazy, cached Admin `Auth`. Node runtime only (never import into `src/middleware.ts`).
- **Auth:** service-account key. `FIREBASE_SERVICE_ACCOUNT` may be raw JSON, base64 JSON, or a JSON string wrapping JSON; literal `\n` in `private_key` are normalised. Base64 support was added in `584e541` because hosting dashboards mangled the multi-line key.
- **Access posture:** server only verifies ID tokens; it never creates, updates or deletes Firebase users.

## Entities / Tables / Endpoints
| Name | Purpose |
|---|---|
| Firebase Auth user | credential holder; `uid` stored as `User.firebaseUid` |
| ID token | short-lived proof sent once to `POST /api/auth/login` or `POST /api/auth/register` |
| Sign-in providers | Email/Password and Google must be enabled in the Firebase console |

## Schema / Shape
```ts
// what the server reads from a verified ID token (firebase-admin DecodedIdToken)
{ uid: string; email?: string; name?: string }
// what it stores on the Mongo User
{ firebaseUid: string; email: string /* lowercased */; name: string }
```

## Functions We Call
| Function | Returns | Used by |
|---|---|---|
| `signInWithEmailAndPassword(auth, …)` | `UserCredential` | `src/app/(auth)/login/page.tsx` | <!-- verify:ignore -->
| `createUserWithEmailAndPassword(auth, …)` | `UserCredential` | `src/app/(auth)/register/page.tsx` | <!-- verify:ignore -->
| `cred.user.delete()` | void | register page — rollback when `POST /api/auth/register` fails |
| `signInWithPopup(auth, GoogleAuthProvider)` | `UserCredential` | `src/components/auth/GoogleSignInButton.tsx` (login + register pages) | <!-- verify:ignore -->
| `sendPasswordResetEmail(auth, email)` | void | `src/app/(auth)/forgot-password/page.tsx` (always shows success to avoid enumeration) |
| `user.getIdToken()` | ID token string | all of the above, before calling the API |
| `signOut(auth)` | void | `src/components/AppShell.tsx` logout, then `POST /api/auth/logout` |
| `getAdminAuth().verifyIdToken(idToken)` | `DecodedIdToken` | `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts` | <!-- verify:ignore -->
| `serviceAccountDiag()` | secret-free summary string | error messages from `getAdminAuth` |

## Degradation
- **Admin credentials missing/invalid:** `getAdminAuth()` throws on first use (lazy by design — eager init crashed the route module with an opaque 500 in prod, per the code comment). Login/register return `500 "Could not complete sign-in…"` with `detail` = the error message (includes `serviceAccountDiag()` output: length and shape hints, never the key). Already-signed-in users are unaffected — no other route touches Firebase.
- **Bad/expired ID token:** `401 "Invalid or expired sign-in token"`.
- **Firebase client unreachable:** sign-in pages show the mapped Firebase error (`firebaseErr` / `googleErr`); existing sessions keep working until `sm_session` expires.

> [!WARNING]
> `NEXT_PUBLIC_FIREBASE_*` are inlined at build time and the `Dockerfile` passes none, so production always uses the literal fallback config in `src/lib/firebase/client.ts`. Changing Firebase projects means changing those literals or adding build args — Cloud Run runtime env vars won't do it.

> [!TODO]
> Code comments in `src/lib/firebase/admin.ts` and `src/app/api/auth/login/route.ts` refer to Vercel, while production is Cloud Run. Whether a Vercel deployment still exists, and whether the `detail` echo in auth 500s can now be removed ("Remove/gate once prod is stable"), needs a human.
