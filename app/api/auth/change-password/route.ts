import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

// POST /api/auth/change-password — change own password (requires current password)
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = await verifyToken(token);

    const body = await req.json() as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 }
      );
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = db.select().from(users).where(eq(users.id, session.userId)).get();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    db.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[change-password]", err);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
