import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Paths that don't require authentication
// /assess/[token] — customer self-assessment (token IS the auth)
// /assess/complete — static thank-you page
// /api/assess/ — public token validation and submission endpoints
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/assess/", "/api/assess/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    // jose works in Edge runtime — no Node.js APIs needed here
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);

    // Admin routes require role = "admin"
    const role = (payload as { role?: string }).role ?? "staff";
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token — clear cookie and redirect
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("session");
    return response;
  }
}

export const config = {
  // Match all paths except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
