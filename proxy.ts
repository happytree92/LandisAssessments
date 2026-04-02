import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Paths that require no authentication.
 * All other paths require a valid session cookie.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/mfa/challenge", // second-factor during login (uses pre-auth cookie, not session)
  "/api/auth/sso",           // SSO start + callback — must be public for the OIDC redirect loop
  "/api/assess",             // public customer self-assessment API
  "/assess",                 // public customer self-assessment UI
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix + "/") ||
      pathname.startsWith(prefix + "?")
  );
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;

  if (!token) {
    return unauthenticated(req);
  }

  try {
    const secret = process.env.JWT_SECRET ?? "";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    // Admin pages/routes require role = "admin"
    const role = (payload as { role?: string }).role ?? "staff";
    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
      role !== "admin"
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token — clear cookie and redirect/401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.delete("session");
    return response;
  }
}

function unauthenticated(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
