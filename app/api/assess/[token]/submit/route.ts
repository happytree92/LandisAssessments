import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessmentTokens, assessments } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { calculateScore } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AssessmentResult } from "@/lib/scoring";

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/assess/[token]/submit — PUBLIC: submit a customer self-assessment
// Write-only — never returns existing assessment data or customer records.
export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { token } = await params;
    const now = Math.floor(Date.now() / 1000);

    // Re-validate token on every submission attempt
    const record = db
      .select()
      .from(assessmentTokens)
      .where(eq(assessmentTokens.token, token))
      .get();

    if (!record || record.isActive === 0 || record.expiresAt < now) {
      return NextResponse.json(
        { error: "This link is invalid or has expired." },
        { status: 410 }
      );
    }

    // Single-use: reject resubmission
    if (record.usedAt) {
      return NextResponse.json(
        { error: "This assessment has already been submitted." },
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

    // Fetch questions and validate all are answered
    const questions = getQuestionsForTemplate(record.templateId);
    const unanswered = questions.filter((q) => !answers[q.id]?.answer);
    if (unanswered.length > 0) {
      return NextResponse.json(
        { error: `${unanswered.length} question(s) not answered` },
        { status: 400 }
      );
    }

    // Calculate score server-side — never trust client-provided scores
    const results: AssessmentResult[] = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id].answer as AssessmentResult["answer"],
      notes: answers[q.id].notes,
    }));
    const { overall, categories } = calculateScore(results, questions);

    // Save the completed assessment
    // conductedBy = the staff member who created the token
    db.insert(assessments)
      .values({
        customerId: record.customerId,
        conductedBy: record.createdBy,
        templateId: record.templateId,
        answers: JSON.stringify(answers),
        overallScore: overall,
        categoryScores: JSON.stringify(categories),
        source: "customer_link",
        completedAt: now,
        createdAt: now,
      })
      .run();

    // Mark token as used — single-use enforcement
    db.update(assessmentTokens)
      .set({ usedAt: now, submittedFromIp: ip })
      .where(eq(assessmentTokens.token, token))
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
