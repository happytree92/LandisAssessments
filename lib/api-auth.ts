/**
 * Shared helpers for API route authentication and authorization.
 * Use requireSession for any authenticated route, requireAdmin for admin-only routes.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Requires a valid session cookie for a user who is still active. Returns the
 * session payload (role and name as they are in the DB now) or a 401 NextResponse.
 * Usage: const session = await requireSession(req); if (isAuthError(session)) return session;
 */
export async function requireSession(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await getSession(token);
  if (!session) {
    return NextResponse.json({ error: "Session expired — please sign in again" }, { status: 401 });
  }
  return session;
}

/**
 * Requires a valid session whose user is an admin in the DB right now.
 * Returns the session payload or a 401/403 NextResponse.
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
