/**
 * POST /api/auth/mfa/enable
 * Verifies the first TOTP code from the authenticator app and enables MFA for the account.
 * The secret must have been generated via GET /api/auth/mfa/setup first.
 * Body: { code: "123456" }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifySync } from "otplib";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, isAuthError } from "@/lib/api-auth";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const body = await req.json();
    const { code } = body as { code: unknown };

    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "A 6-digit code is required" }, { status: 400 });
    }

    const user = db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user || !user.mfaSecret) {
      return NextResponse.json(
        { error: "No MFA setup in progress. Generate a secret first." },
        { status: 400 }
      );
    }

    if (user.mfaEnabled === 1) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 409 });
    }

    const result = verifySync({ token: code, secret: user.mfaSecret });
    if (!result.valid) {
      return NextResponse.json(
        { error: "Invalid code. Make sure your authenticator app is synced and try again." },
        { status: 400 }
      );
    }

    db.update(users)
      .set({ mfaEnabled: 1 })
      .where(eq(users.id, session.userId))
      .run();

    log({
      level: "info",
      category: "auth",
      action: "mfa.enabled",
      userId: session.userId,
      username: session.username,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mfa/enable]", err);
    return NextResponse.json({ error: "Failed to enable MFA" }, { status: 500 });
  }
}
