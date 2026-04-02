/**
 * POST /api/auth/mfa/challenge
 * Second step of MFA login. Reads the pre-auth cookie (set by /api/auth/login),
 * verifies the TOTP code, and issues the full session cookie on success.
 *
 * This route is in proxy.ts PUBLIC_PREFIXES because the user is not yet
 * fully authenticated at this point.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifySync } from "otplib";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPreAuthToken, signToken, tokenFingerprint } from "@/lib/auth";
import { log } from "@/lib/logger";
import { recordLoginSuccess, recordLoginFailure } from "@/lib/login-rate-limit";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getIp(req);
  try {
    const preauthCookie = req.cookies.get("preauth")?.value;
    if (!preauthCookie) {
      return NextResponse.json({ error: "No pending MFA session" }, { status: 400 });
    }

    let preAuth;
    try {
      preAuth = await verifyPreAuthToken(preauthCookie);
    } catch {
      // Expired or tampered pre-auth token
      const response = NextResponse.json(
        { error: "MFA session expired. Please sign in again." },
        { status: 401 }
      );
      response.cookies.delete("preauth");
      return response;
    }

    const body = await req.json();
    const { code } = body as { code: unknown };

    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "A 6-digit code is required" },
        { status: 400 }
      );
    }

    // Re-fetch user to get current MFA secret
    const user = db.select().from(users).where(eq(users.id, preAuth.userId)).get();

    if (!user || user.isActive === 0 || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: "MFA is not configured for this account" }, { status: 400 });
    }

    const result = verifySync({ token: code, secret: user.mfaSecret });

    if (!result.valid) {
      recordLoginFailure(ip, user.username);
      log({
        level: "warn",
        category: "auth",
        action: "login.mfa_failed",
        userId: user.id,
        username: user.username,
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    }

    // MFA passed — issue full session
    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role ?? "staff",
      pwdAt: user.passwordChangedAt ?? undefined,
    });

    recordLoginSuccess(ip, user.username);

    log({
      level: "info",
      category: "auth",
      action: "login.success",
      userId: user.id,
      username: user.username,
      ipAddress: ip,
      metadata: { mfa: true, tokenFingerprint: tokenFingerprint(token) },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role ?? "staff",
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    response.cookies.delete("preauth");

    return response;
  } catch (err) {
    console.error("[mfa/challenge]", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
