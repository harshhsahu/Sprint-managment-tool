---
covers: ["src/app/api/auth/**", "src/app/api/users/**", "src/lib/auth.ts", "src/lib/apiHelpers.ts"]
verified_at: 5ec7e9c
verified_on: 2026-10-23
---

# API — Auth & Users

> Handlers in `src/app/api/auth/` and `src/app/api/users/`. Client calls live in `src/store/api.ts` (`login`, `register`, `logout`, `getMe`, `updateMe`, `updateUser`).

## Purpose
Exchange a Firebase ID token for the app session, log out, read/update the current user, and let the super admin manage accounts. Powers the `(auth)` pages, the topbar user menu (`src/components/AppShell.tsx`) and `/admin` users tab. Security model: [../13-security.md](../13-security.md). Firebase details: [../current-infrastructure/firebase.md](../current-infrastructure/firebase.md).

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | verify Firebase ID token, create the Mongo user, start a session |
| `/api/auth/login` | POST | verify Firebase ID token, find/link/auto-provision the user, start a session |
| `/api/auth/logout` | POST | delete the session cookie |
| `/api/auth/me` | GET | current user |
| `/api/auth/me` | PATCH | update own profile |
| `/api/users` | GET | list users (any authed user; `?all=1` super admin only) |
| `/api/users/[id]` | PATCH | super admin: activate/deactivate, set designation |

There are no password or reset routes: Firebase owns credentials, and "forgot password" calls Firebase `sendPasswordResetEmail` directly from `src/app/(auth)/forgot-password/page.tsx`.

All errors use `{ error: string, ...extra }` from `src/lib/apiHelpers.ts:error`. Body validation failures → `422` (`"path: message; …"`), unparseable JSON → `400 "Invalid JSON body"`.

---

## POST /api/auth/register

### Purpose
Create the Mongo profile for a Firebase user that the browser just created with `createUserWithEmailAndPassword`.

### Body
```ts
{
  idToken: string;          // Firebase ID token, min 1
  name: string;             // 2–80
  designation?: string;     // ≤80, default ""
  timezone?: string;        // ≤60, default "UTC" (client sends the browser zone)
}
```

### Response — 201
```ts
{ user: { _id: string; name: string; email: string; role: "super_admin" | "member" } }
```
Sets `sm_session` (see Behavior Notes).

### Errors
| Status | When |
|---|---|
| 401 | `"Invalid or expired sign-in token"` — `verifyIdToken` failed |
| 400 | `"Firebase account has no email"` |
| 409 | email **or** `firebaseUid` already exists (also on an `E11000` race) |
| 500 | `"Could not complete registration. Please try again."` + `detail` (raw exception message), e.g. missing `FIREBASE_SERVICE_ACCOUNT` |

### Behavior Notes
- Email is lowercased from the token, not taken from the body.
- `role` is `super_admin` only when the email matches `src/lib/constants.ts:SUPER_ADMIN_EMAIL`; it is display-only.
- If this call fails, `src/app/(auth)/register/page.tsx` deletes the just-created Firebase user so the email can be retried.

## POST /api/auth/login

### Purpose
Start a session for a user signed in via Firebase (email/password or Google popup).

### Body
```ts
{ idToken: string }
```

### Response — 200
```ts
{ user: { _id: string; name: string; email: string; role: "super_admin" | "member" } }
```

### Behavior Notes
- Lookup order: `User.firebaseUid === uid` → else `User.email === token email` (and backfills `firebaseUid` on legacy accounts) → else **auto-provisions** a new `member` (name = token name or email local part). Auto-provision is how first-time Google users get a profile — so `login` can create accounts too.
- `401 "Invalid or expired sign-in token"`, `401 "No account found for this user"` (token without email), `403 "This account has been deactivated"`, `500` + `detail` on server errors.
- The login page then navigates to `?next=` or `/dashboard`.

## POST /api/auth/logout
- No auth required. Deletes `sm_session` and returns `{ ok: true }`. The issued JWT stays valid until expiry; the client also calls Firebase `signOut` (`src/components/AppShell.tsx`).

## GET /api/auth/me
- `withAuth()` → `{ user }`: the full `User` document minus `passwordHash` (includes `firebaseUid`, `active`, `designation`, `timezone`, `avatarColor`, timestamps). `401 { error: "Unauthorized" }` when the cookie is missing/invalid or the user is gone or inactive.

## PATCH /api/auth/me

### Body
```ts
{ name?: string /*2–80*/; designation?: string /*≤80*/; timezone?: string /*≤60*/; avatarColor?: string /*≤20*/ }
```
- `$set` on the caller's own document; returns `{ user }` (no `passwordHash`). Email and role cannot be changed here. No activity is logged.

---

## GET /api/users

### Purpose
List users. Comment says "for member pickers, invites"; the only in-app caller today is `/admin` (`src/app/(app)/admin/page.tsx`, `?all=1`).

### Query Parameters
| Param | Type | Description |
|---|---|---|
| `q` | string | case-insensitive `$regex` on `name` or `email` (**not escaped**) |
| `all` | `"1"` | include inactive users — honoured only for the super admin |

### Response — 200
```ts
{ users: User[] }   // sorted by name, max 100, without passwordHash
```

> [!WARNING]
> Any authenticated user can call this and get up to 100 **active users from every tenant** (names, emails, designations). `q` is passed raw into `$regex`. See [../13-security.md](../13-security.md#access--visibility-tenant-isolation).

## PATCH /api/users/[id]

### Body
```ts
{ active?: boolean; designation?: string /*≤80*/ }
```
- `403 "Only the super admin can manage users"` unless `isSuperAdmin(caller)`.
- `400 "You cannot deactivate your own account"`; `404 "User not found"`.
- `role` is deliberately not in the schema — super admin is pinned to `SUPER_ADMIN_EMAIL`.
- Logs `user.updated` activity with `meta` = the body; returns `{ user }`.
- Deactivation takes effect on the user's next API call (`requireUser` checks `active`); no session revocation.

---

## Session cookie (all session-creating routes)
| Attribute | Value |
|---|---|
| name | `sm_session` (`src/lib/auth.ts:SESSION_COOKIE`) |
| payload | `{ userId, email, name, role }`, HS256, `iat`, `exp` = 7 days (`signSession`) |
| flags | `httpOnly`, `sameSite: "lax"`, `secure` when `NODE_ENV === "production"`, `path: "/"`, `maxAge` 7 days |

### Example
```json
// POST /api/auth/login  { "idToken": "<firebase id token>" }
{ "user": { "_id": "665f…", "name": "Bob Verma", "email": "bob@demo.dev", "role": "member" } }
```
