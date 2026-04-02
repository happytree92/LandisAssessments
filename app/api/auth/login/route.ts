import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { signToken, signPreAuthToken } from "@/lib/auth";
import { log } from "@/lib/logger";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/login-rate-limit";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Check whether an IP is permitted by the admin_ip_allowlist setting.
 * Returns true if allowed (either no allowlist configured, or IP is on the list).
 */
function isIpAllowed(ip: string, allowlist: string): boolean {
  const entries = allowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return true; // no allowlist configured
  return entries.includes(ip);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getIp(req);
  try {
    const body = await req.json();
    const { username, password } = body as {
      username: unknown;
      password: unknown;
    };

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // ── Brute-force check ───────────────────────────────────────────────────
    const rateCheck = checkLoginRateLimit(ip, username);
    if (!rateCheck.allowed) {
      log({
        level: "warn",
        category: "auth",
        action: "login.rate_limited",
        ipAddress: ip,
        metadata: {
          attemptedUsername: username,
          retryAfterSeconds: rateCheck.retryAfter,
        },
      });
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minute(s).`,
        },
        { status: 429 }
      );
    }

    const user = db.select().from(users).where(eq(users.username, username)).get();

    // Use a constant-time comparison path regardless of whether the user exists
    // to avoid username enumeration via timing
    const passwordHash = user?.passwordHash ?? "$2b$12$invalidhashforinvaliduser000000";
    const valid = await bcrypt.compare(password, passwordHash);

    if (!user || !valid || user.isActive === 0) {
      recordLoginFailure(ip, username);
      log({
        level: "warn",
        category: "auth",
        action: "login.failed",
        ipAddress: ip,
        metadata: { attemptedUsername: username },
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // ── IP allowlist check for admin accounts ───────────────────────────────
    if (user.role === "admin") {
      const settingsRows = db.select().from(settings).all();
      const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
      const allowlistRaw = settingsMap["admin_ip_allowlist"] ?? "";

      if (!isIpAllowed(ip, allowlistRaw)) {
        recordLoginFailure(ip, username);
        log({
          level: "warn",
          category: "auth",
          action: "login.ip_blocked",
          ipAddress: ip,
          metadata: { username: user.username, role: user.role },
        });
        return NextResponse.json(
          { error: "Login from this IP address is not permitted." },
          { status: 403 }
        );
      }
    }

    // ── MFA check ───────────────────────────────────────────────────────────
    if (user.mfaEnabled === 1 && user.mfaSecret) {
      // Password is correct but MFA is required — issue a short-lived pre-auth token.
      // The full session cookie is only set after TOTP verification.
      const preAuthToken = await signPreAuthToken({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role ?? "staff",
        mfaPending: true,
      });

      const response = NextResponse.json({ mfaRequired: true });
      response.cookies.set("preauth", preAuthToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 5, // 5 minutes to complete MFA
      });
      return response;
    }

    // ── Full login — no MFA required ────────────────────────────────────────
    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role ?? "staff",
    });

    recordLoginSuccess(ip, username);

    log({
      level: "info",
      category: "auth",
      action: "login.success",
      userId: user.id,
      username: user.username,
      ipAddress: ip,
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
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
