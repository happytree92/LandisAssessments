import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, assessments, assessmentTokens } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/admin/users/[id] — admin only, hard-delete a user and nullify their assessments
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
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
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

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
      mfaEnforced?: number;
      mfaReset?: boolean;
    };

    // Block password changes for SSO accounts — they have no local credential
    if (typeof body.password === "string" && body.password.length > 0 && existing.ssoProvider) {
      return NextResponse.json(
        { error: "Cannot set a password for SSO accounts." },
        { status: 400 }
      );
    }

    // Prevent an admin from deactivating their own account
    if (typeof body.isActive === "number" && body.isActive === 0 && session.userId === userId) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 403 }
      );
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
      updates.passwordHash = await hashPassword(body.password);
    } else if (typeof body.password === "string" && body.password.length > 0) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (typeof body.mfaEnforced === "number") {
      updates.mfaEnforced = body.mfaEnforced;
    }
    if (body.mfaReset === true) {
      updates.mfaSecret = null;
      updates.mfaEnabled = 0;
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
        mfaEnabled: users.mfaEnabled,
        mfaEnforced: users.mfaEnforced,
      })
      .get();

    if (typeof body.isActive === "number" && body.isActive === 0) {
      log({
        level: "warn",
        category: "user",
        action: "user.deactivated",
        userId: session.userId,
        username: session.username,
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
        userId: session.userId,
        username: session.username,
        resourceType: "user",
        resourceId: userId,
        metadata: { targetUsername: existing.username, previousRole: existing.role, newRole: body.role },
      });
    }
    if (typeof body.mfaEnforced === "number") {
      log({
        level: "warn",
        category: "user",
        action: body.mfaEnforced === 1 ? "user.mfa_enforced" : "user.mfa_unenforced",
        userId: session.userId,
        username: session.username,
        resourceType: "user",
        resourceId: userId,
        metadata: { targetUsername: existing.username },
      });
    }
    if (body.mfaReset === true) {
      log({
        level: "warn",
        category: "user",
        action: "user.mfa_reset",
        userId: session.userId,
        username: session.username,
        resourceType: "user",
        resourceId: userId,
        metadata: { targetUsername: existing.username },
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
