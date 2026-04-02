/**
 * POST /api/auth/mfa/disable
 * Disables MFA for the current user's account.
 * Requires current password for confirmation.
 * Body: { password: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, isAuthError } from "@/lib/api-auth";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const body = await req.json();
    const { password } = body as { password: unknown };

    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const user = db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    if (!user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 409 });
    }

    db.update(users)
      .set({ mfaEnabled: 0, mfaSecret: null })
      .where(eq(users.id, session.userId))
      .run();

    log({
      level: "warn",
      category: "auth",
      action: "mfa.disabled",
      userId: session.userId,
      username: session.username,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mfa/disable]", err);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}
