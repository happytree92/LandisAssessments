import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessmentTokens } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/assessment-tokens/[id] — revoke a pending token (staff)
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await verifyToken(sessionCookie);

    const { id } = await params;
    const tokenId = parseInt(id, 10);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db.select().from(assessmentTokens).where(eq(assessmentTokens.id, tokenId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Only revoke tokens that are still pending (not used, not already expired)
    if (existing.usedAt) {
      return NextResponse.json({ error: "Cannot revoke a completed token" }, { status: 409 });
    }

    db.update(assessmentTokens)
      .set({ isActive: 0 })
      .where(eq(assessmentTokens.id, tokenId))
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }
}
