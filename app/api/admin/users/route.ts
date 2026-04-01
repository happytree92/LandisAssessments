import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";

// GET /api/admin/users — list all users
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .all();
    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    const session = sessionCookie ? await verifyToken(sessionCookie).catch(() => null) : null;
    const body = await req.json() as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: string;
    };

    const username = String(body.username ?? "").trim().toLowerCase();
    const displayName = String(body.displayName ?? "").trim();
    const password = String(body.password ?? "");
    const role = body.role === "admin" ? "admin" : "staff";

    if (!username || !displayName || !password) {
      return NextResponse.json(
        { error: "username, displayName, and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = db
      .insert(users)
      .values({
        username,
        passwordHash,
        displayName,
        role,
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .returning({ id: users.id, username: users.username, displayName: users.displayName, role: users.role })
      .get();

    log({
      level: "info",
      category: "user",
      action: "user.created",
      userId: session?.userId,
      username: session?.username,
      resourceType: "user",
      resourceId: created.id,
      metadata: { newUsername: created.username, role: created.role },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/users POST]", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
