import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signToken } from "@/lib/auth";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const body = await req.json();
    const { username, password } = body as {
      username: unknown;
      password: unknown;
    };

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    // Use a constant-time comparison path regardless of whether the user exists
    // to avoid username enumeration via timing
    const passwordHash = user?.passwordHash ?? "$2b$12$invalidhashforinvaliduser000000";
    const valid = await bcrypt.compare(password, passwordHash);

    if (!user || !valid || user.isActive === 0) {
      log({
        level: "warn",
        category: "auth",
        action: "login.failed",
        ipAddress: ip,
        metadata: { attemptedUsername: typeof username === "string" ? username : "unknown" },
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role ?? "staff",
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role ?? "staff",
      },
    });

    log({
      level: "info",
      category: "auth",
      action: "login.success",
      userId: user.id,
      username: user.username,
      ipAddress: ip,
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
