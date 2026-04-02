/**
 * Shared helpers for API route authentication and authorization.
 * Use requireSession for any authenticated route, requireAdmin for admin-only routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

/**
 * Requires a valid session cookie. Returns the session payload or a 401 NextResponse.
 * Usage: const session = await requireSession(req); if (isAuthError(session)) return session;
 */
export async function requireSession(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Requires a valid session with role=admin. Returns the session payload or a 401/403 NextResponse.
 */
export async function requireAdmin(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const result = await requireSession(req);
  if (result instanceof NextResponse) return result;
  if (result.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/**
 * Type guard — returns true if the value is an error response, not a session.
 */
export function isAuthError(val: SessionPayload | NextResponse): val is NextResponse {
  return val instanceof NextResponse;
}
