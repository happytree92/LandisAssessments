import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Best-effort: extract user info from session before clearing it
    const sessionCookie = req.cookies.get("session")?.value;
    if (sessionCookie) {
      try {
        const session = await verifyToken(sessionCookie);
        log({
          level: "info",
          category: "auth",
          action: "logout",
          userId: session.userId,
          username: session.username,
        });
      } catch {
        // Token already invalid — still clear the cookie
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");
    return response;
  } catch {
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
