import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] — update displayName, role, password, or isActive
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db.select().from(users).where(eq(users.id, userId)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json() as {
      displayName?: string;
      role?: string;
      password?: string;
      isActive?: number;
    };

    // Prevent an admin from deactivating their own account
    if (typeof body.isActive === "number" && body.isActive === 0) {
      const token = req.cookies.get("session")?.value;
      if (token) {
        try {
          const session = await verifyToken(token);
          if (session.userId === userId) {
            return NextResponse.json(
              { error: "You cannot deactivate your own account" },
              { status: 403 }
            );
          }
        } catch {
          // proceed
        }
      }
    }

    const updates: Partial<typeof existing> = {};

    if (typeof body.displayName === "string" && body.displayName.trim()) {
      updates.displayName = body.displayName.trim();
    }
    if (body.role === "admin" || body.role === "staff") {
      updates.role = body.role;
    }
    if (typeof body.isActive === "number") {
      updates.isActive = body.isActive;
    }
    if (typeof body.password === "string" && body.password.length >= 8) {
      updates.passwordHash = await bcrypt.hash(body.password, 12);
    } else if (typeof body.password === "string" && body.password.length > 0) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const updated = db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
      })
      .get();

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
