import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions, templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

// GET /api/admin/questions — all questions with template info
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const rows = db
      .select({
        id: questions.id,
        templateId: questions.templateId,
        templateSlug: templates.slug,
        templateName: templates.name,
        category: questions.category,
        text: questions.text,
        weight: questions.weight,
        yesScore: questions.yesScore,
        noScore: questions.noScore,
        maybeScore: questions.maybeScore,
        sortOrder: questions.sortOrder,
        isActive: questions.isActive,
      })
      .from(questions)
      .leftJoin(templates, eq(questions.templateId, templates.id))
      .orderBy(questions.templateId, questions.sortOrder)
      .all();

    return NextResponse.json({ questions: rows });
  } catch (err) {
    console.error("[admin/questions GET]", err);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}
