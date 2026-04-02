import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions, templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

// GET /api/admin/questions/export — download all questions as CSV
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const rows = db
      .select({
        templateSlug: templates.slug,
        category: questions.category,
        text: questions.text,
        weight: questions.weight,
        yesScore: questions.yesScore,
        noScore: questions.noScore,
        maybeScore: questions.maybeScore,
        isActive: questions.isActive,
      })
      .from(questions)
      .leftJoin(templates, eq(questions.templateId, templates.id))
      .orderBy(questions.templateId, questions.sortOrder)
      .all();

    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const header = "template,category,question,weight,yes_score,no_score,maybe_score,is_active";
    const lines = rows.map((r) =>
      [
        escape(r.templateSlug ?? ""),
        escape(r.category),
        escape(r.text),
        r.weight,
        r.yesScore,
        r.noScore,
        r.maybeScore,
        r.isActive ?? 1,
      ].join(",")
    );

    const csv = [header, ...lines].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="questions.csv"',
      },
    });
  } catch (err) {
    console.error("[admin/questions/export]", err);
    return NextResponse.json({ error: "Failed to export questions" }, { status: 500 });
  }
}
