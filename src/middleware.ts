import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isSuperAdminEmail } from "@/lib/constants";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // The marketing landing page ("/") is public — exact match, since a startsWith
  // check on "/" would make every route public.
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = req.cookies.get("sm_session")?.value;

  let authed = false;
  let email: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      authed = true;
      email = typeof payload.email === "string" ? payload.email : undefined;
    } catch {
      authed = false;
    }
  }

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // /admin is reserved for the single designated super admin.
  if (authed && pathname.startsWith("/admin") && !isSuperAdminEmail(email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Logged-in users hitting an auth page (login/register/…) are sent to the app,
  // but the landing page ("/") stays viewable while authed — it shows a
  // "Go to app" CTA instead of sign-in.
  if (authed && isPublic && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // protect everything except API routes (they check auth themselves), static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)"],
};
