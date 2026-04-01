import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, assessments, assessmentTokens } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/users/[id] — admin only, hard-delete a user and nullify their assessments
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await verifyToken(sessionCookie);
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // Prevent self-deletion
    if (session.userId === userId) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 });
    }

    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Block deletion if this is the last admin
    if (target.role === "admin") {
      const adminCount = db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, 1)))
        .get()?.count ?? 0;
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the only admin account. Promote another user to admin first." },
          { status: 409 }
        );
      }
    }

    // Nullify conducted_by on assessments created by this user — assessments remain intact
    db.update(assessments)
      .set({ conductedBy: null })
      .where(eq(assessments.conductedBy, userId))
      .run();

    // Nullify created_by on any assessment tokens created by this user
    db.update(assessmentTokens)
      .set({ createdBy: null })
      .where(eq(assessmentTokens.createdBy, userId))
      .run();

    db.delete(users).where(eq(users.id, userId)).run();

    log({
      level: "warn",
      category: "user",
      action: "user.deleted",
      userId: session.userId,
      username: session.username,
      resourceType: "user",
      resourceId: userId,
      metadata: { deletedUsername: target.username, deletedRole: target.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/users DELETE]", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

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

    // Capture who is making the change (already have token from self-deactivation check above)
    const adminToken = req.cookies.get("session")?.value;
    const adminSession = adminToken ? await verifyToken(adminToken).catch(() => null) : null;

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

    if (typeof body.isActive === "number" && body.isActive === 0) {
      log({
        level: "warn",
        category: "user",
        action: "user.deactivated",
        userId: adminSession?.userId,
        username: adminSession?.username,
        resourceType: "user",
        resourceId: userId,
        metadata: { targetUsername: existing.username },
      });
    }
    if (body.role === "admin" || body.role === "staff") {
      log({
        level: "warn",
        category: "user",
        action: "user.role_changed",
        userId: adminSession?.userId,
        username: adminSession?.username,
        resourceType: "user",
        resourceId: userId,
        metadata: { targetUsername: existing.username, previousRole: existing.role, newRole: body.role },
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
