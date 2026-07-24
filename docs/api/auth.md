# API — Auth

> Session/auth routes. Handlers in [`src/app/api/auth/**`](../../src/app/api/auth).

## Purpose
Register, log in, log out, and read/update the current user. Powers the `(auth)` pages and
the topbar user menu. A JWT session lives in the httpOnly cookie `sm_session`.

---

## Routes in This Domain

| Route | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | create an account + start a session |
| `/api/auth/login` | POST | authenticate + start a session |
| `/api/auth/logout` | POST | clear the session cookie |
| `/api/auth/me` | GET | current user |
| `/api/auth/me` | PATCH | update own profile |

> Note: forgot/reset-password routes were intentionally removed (no mail server). See
> [../17-notifications.md](../17-notifications.md).

---

## POST /api/auth/register
### Body
```ts
{ name: string; email: string; password: string(min 8); designation?: string; timezone?: string }
```
### Behavior
- 409 if email exists. Hashes password with bcrypt.
- **First-ever account becomes `super_admin`**; everyone else is `member`.
- Sets `sm_session` cookie; returns `{ user: { _id, name, email, role } }` (201).

## POST /api/auth/login
### Body `{ email, password }`
- 401 on bad credentials; 403 if the account is deactivated.
- Sets `sm_session`; returns `{ user }`.

## GET /api/auth/me
- Returns `{ user }` (password hash excluded) or `401`.

## PATCH /api/auth/me
### Body `{ name?, designation?, timezone?, avatarColor? }`
- Updates the current user's profile; returns `{ user }`.

### Response — auth failure
```ts
{ error: "Unauthorized" }   // 401
```

### Behavior Notes
- Cookie: httpOnly, SameSite=Lax, `secure` in production, 7-day maxAge.
- `withAuth()` re-validates the JWT and that the user still exists and is `active`.
