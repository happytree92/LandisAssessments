import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers, users } from "@/lib/db/schema";
import { calculateScore } from "@/lib/scoring";
import { securityQuestions, onboardingQuestions } from "@/lib/questions";
import type { AssessmentResult } from "@/lib/scoring";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assessments/[id] — get assessment with customer info
export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
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
      .leftJoin(users, eq(assessments.conductedBy, users.id))
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

// PATCH /api/assessments/[id] — submit answers, calculate score, mark complete
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
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

    // Choose the correct question bank for this template
    const questions =
      existing.templateId === "security" ? securityQuestions : onboardingQuestions;

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

    return NextResponse.json({ assessment: completed });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json(
      { error: "Failed to complete assessment" },
      { status: 500 }
    );
  }
}
