/**
 * GET /api/auth/mfa/setup/secret
 * Returns the pending TOTP secret for manual authenticator entry.
 * Only valid after calling GET /api/auth/mfa/setup (which generates and stores the secret).
 * The secret is not included in the setup response to avoid leaking it into proxy/APM logs;
 * it is only returned here when the user explicitly requests it.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, isAuthError } from "@/lib/api-auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const user = db.select().from(users).where(eq(users.id, session.userId)).get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only return the secret if MFA setup is in progress (secret stored but not yet enabled)
    if (!user.mfaSecret || user.mfaEnabled === 1) {
      return NextResponse.json(
        { error: "No pending MFA setup. Call GET /api/auth/mfa/setup first." },
        { status: 409 }
      );
    }

    return NextResponse.json({ secret: user.mfaSecret });
  } catch (err) {
    console.error("[mfa/setup/secret]", err);
    return NextResponse.json({ error: "Failed to retrieve MFA secret" }, { status: 500 });
  }
}
