/**
 * Shared helpers for API route authentication and authorization.
 * Use requireSession for any authenticated route, requireAdmin for admin-only routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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
    const session = await verifyToken(token);

    // Validate that the session hasn't been invalidated by a password change.
    // users.passwordChangedAt is set whenever a password is changed (by the user
    // or by an admin reset). A token whose pwdAt doesn't match the current DB value
    // was issued before the change and must be rejected.
    const row = db
      .select({ passwordChangedAt: users.passwordChangedAt })
      .from(users)
      .where(eq(users.id, session.userId))
      .get();

    if (!row) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      row.passwordChangedAt !== null &&
      row.passwordChangedAt !== (session.pwdAt ?? null)
    ) {
      return NextResponse.json({ error: "Session expired — please sign in again" }, { status: 401 });
    }

    return session;
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
