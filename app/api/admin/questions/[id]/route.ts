import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/questions/[id] — toggle isActive or update fields
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const { id } = await params;
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db.select().from(questions).where(eq(questions.id, questionId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await req.json() as Record<string, unknown>;

    const updated = db
      .update(questions)
      .set({
        ...(typeof body.isActive === "number" ? { isActive: body.isActive } : {}),
        ...(typeof body.weight === "number" ? { weight: body.weight } : {}),
        ...(typeof body.yesScore === "number" ? { yesScore: body.yesScore } : {}),
        ...(typeof body.noScore === "number" ? { noScore: body.noScore } : {}),
        ...(typeof body.maybeScore === "number" ? { maybeScore: body.maybeScore } : {}),
      })
      .where(eq(questions.id, questionId))
      .returning()
      .get();

    return NextResponse.json({ question: updated });
  } catch (err) {
    console.error("[admin/questions PATCH]", err);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}
