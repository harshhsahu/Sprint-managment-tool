"use client";

/** Client-side fetch helpers used with SWR and mutations. */

const AUTH_PATHS = ["/login", "/register"];

/** Session expired / unauthorized → send the user to the login page, remembering
    where they were so they land back there after signing in. Guards against loops
    (no redirect if we're already on an auth page). */
function redirectToLogin() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return;
  const next = encodeURIComponent(pathname + search);
  window.location.href = `/login?next=${next}`;
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    if (res.status === 401) redirectToLogin();
    throw err;
  }
  return res.json();
}

export async function api<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) redirectToLogin();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
