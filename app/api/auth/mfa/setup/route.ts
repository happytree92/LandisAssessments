/**
 * GET /api/auth/mfa/setup
 * Generates a new TOTP secret for the current user and returns the QR code data URI.
 * Does NOT enable MFA — the user must verify a code first via POST /api/auth/mfa/enable.
 * Requires an active session.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession, isAuthError } from "@/lib/api-auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const secret = generateSecret();
    const otpAuthUrl = generateURI({
      label: session.username,
      issuer: "Landis Assessments",
      secret,
    });
    const qrDataUri = await QRCode.toDataURL(otpAuthUrl);

    // Store the pending secret (not yet enabled — enable happens after verification)
    db.update(users)
      .set({ mfaSecret: secret, mfaEnabled: 0 })
      .where(eq(users.id, session.userId))
      .run();

    return NextResponse.json({
      secret,      // show to user in case they want to enter manually
      qrDataUri,   // base64 PNG data URI for display
    });
  } catch (err) {
    console.error("[mfa/setup]", err);
    return NextResponse.json({ error: "Failed to generate MFA setup" }, { status: 500 });
  }
}
