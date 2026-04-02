import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers, users } from "@/lib/db/schema";
import { calculateScore } from "@/lib/scoring";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { log } from "@/lib/logger";
import { requireSession, requireAdmin, isAuthError } from "@/lib/api-auth";
import type { AssessmentResult } from "@/lib/scoring";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assessments/[id] — get assessment with customer info
export async function GET(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const { id } = await params;
    const assessmentId = parseInt(id, 10);
    if (isNaN(assessmentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = db
      .select({
        assessment: assessments,
        customerName: customers.name,
        conductorName: users.displayName,
      })
      .from(assessments)
      .leftJoin(customers, eq(assessments.customerId, customers.id))
      .leftJoin(users, sql`${assessments.conductedBy} = ${users.id}`)
      .where(eq(assessments.id, assessmentId))
      .get();

    if (!row) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch assessment" },
      { status: 500 }
    );
  }
}

// DELETE /api/assessments/[id] — admin only, hard-delete the assessment and its answers
export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {

    const { id } = await params;
    const assessmentId = parseInt(id, 10);
    if (isNaN(assessmentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    db.delete(assessments).where(eq(assessments.id, assessmentId)).run();

    log({
      level: "warn",
      category: "assessment",
      action: "assessment.deleted",
      userId: session.userId,
      username: session.username,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: { customerId: existing.customerId, templateId: existing.templateId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to delete assessment" }, { status: 500 });
  }
}

// PATCH /api/assessments/[id] — submit answers, calculate score, mark complete
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireSession(req);
  if (isAuthError(session)) return session;

  try {
    const { id } = await params;
    const assessmentId = parseInt(id, 10);
    if (isNaN(assessmentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (existing.completedAt !== null) {
      return NextResponse.json(
        { error: "Assessment is already completed" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const { answers } = body as {
      answers: Record<string, { answer: string; notes?: string }>;
    };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "answers object is required" }, { status: 400 });
    }

    // Fetch active questions for this template from the DB
    const questions = getQuestionsForTemplate(existing.templateId);

    // Validate all questions are answered
    const unanswered = questions.filter((q) => !answers[q.id]?.answer);
    if (unanswered.length > 0) {
      return NextResponse.json(
        {
          error: `${unanswered.length} question(s) not answered`,
          unanswered: unanswered.map((q) => q.id),
        },
        { status: 400 }
      );
    }

    // Build results array for the scoring engine
    const results: AssessmentResult[] = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id].answer as AssessmentResult["answer"],
      notes: answers[q.id].notes,
    }));

    // Calculate score server-side — client score is never trusted
    const { overall, categories } = calculateScore(results, questions);

    const now = Math.floor(Date.now() / 1000);

    const completed = db
      .update(assessments)
      .set({
        answers: JSON.stringify(answers),
        overallScore: overall,
        categoryScores: JSON.stringify(categories),
        completedAt: now,
      })
      .where(eq(assessments.id, assessmentId))
      .returning()
      .get();

    log({
      level: "info",
      category: "assessment",
      action: "assessment.completed",
      userId: session.userId,
      username: session.username,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: { overallScore: overall, templateId: existing.templateId, customerId: existing.customerId },
    });

    return NextResponse.json({ assessment: completed });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json(
      { error: "Failed to complete assessment" },
      { status: 500 }
    );
  }
}
