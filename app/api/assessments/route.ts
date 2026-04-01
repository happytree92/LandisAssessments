import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers, templates } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";

// POST /api/assessments — create a draft assessment (no answers yet)
// Returns the new assessment id so the client can redirect to /conduct
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await verifyToken(token);

    const body = await req.json();
    const { customerId, templateId } = body as {
      customerId: unknown;
      templateId: unknown;
    };

    if (typeof customerId !== "number" || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "customerId (number) and templateId (string) are required" },
        { status: 400 }
      );
    }

    // Validate template exists in DB
    const template = db
      .select()
      .from(templates)
      .where(eq(templates.slug, templateId))
      .get();

    if (!template) {
      return NextResponse.json(
        { error: 'templateId must be "security" or "onboarding"' },
        { status: 400 }
      );
    }

    const customer = db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .get();
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);

    // Create draft — answers/scores populated when completed via PATCH
    const draft = db
      .insert(assessments)
      .values({
        customerId,
        conductedBy: session.userId,
        templateId,
        answers: "{}",
        overallScore: 0,
        categoryScores: "{}",
        completedAt: null,
        createdAt: now,
      })
      .returning()
      .get();

    log({
      level: "info",
      category: "assessment",
      action: "assessment.started",
      userId: session.userId,
      username: session.username,
      resourceType: "assessment",
      resourceId: draft.id,
      metadata: { customerId, templateId },
    });

    return NextResponse.json({ assessment: draft }, { status: 201 });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json(
      { error: "Failed to create assessment" },
      { status: 500 }
    );
  }
}
