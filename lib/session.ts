/**
 * Resolves a session cookie to the user it belongs to, re-checked against the
 * database on every request. A valid signature isn't enough: the account must
 * still exist and be active, and its password must not have changed since the
 * token was issued. Role and display name are read from the database, so a
 * demotion or deactivation takes effect on the next request instead of when
 * the 8-hour token expires.
 *
 * Every access decision based on the session cookie goes through here:
 * proxy.ts, pages, and route handlers (directly or via requireSession /
 * requireAdmin). Only logout reads the token without it, to log who left.
 */

import { eq } from "drizzle-orm";
import { verifyToken, type SessionPayload } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function getSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  let claims: SessionPayload;
  try {
    claims = await verifyToken(token);
  } catch {
    return null;
  }

  const user = db
    .select({
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      passwordChangedAt: users.passwordChangedAt,
    })
    .from(users)
    .where(eq(users.id, claims.userId))
    .get();

  if (!user || user.isActive === 0) return null;

  // users.passwordChangedAt is set on every password change (by the user or an
  // admin reset). A token whose pwdAt doesn't match was issued before it.
  if (user.passwordChangedAt !== null && user.passwordChangedAt !== (claims.pwdAt ?? null)) {
    return null;
  }

  return {
    ...claims,
    username: user.username,
    displayName: user.displayName,
    role: user.role ?? "staff",
  };
}
