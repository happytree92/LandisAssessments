import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { db } from "@/lib/db";
import { assessments, customers, users, templates } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { buildSummary } from "@/lib/summary";
import { AssessmentReport } from "@/components/pdf/AssessmentReport";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";
import type { Answer } from "@/lib/scoring";

type RouteContext = { params: Promise<{ id: string }> };

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 40);
}

function isoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

// GET /api/assessments/[id]/pdf — render and return a PDF for the assessment
export async function GET(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    const session = sessionCookie ? await verifyToken(sessionCookie).catch(() => null) : null;
    const { id } = await params;
    const assessmentId = parseInt(id, 10);
    if (isNaN(assessmentId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const assessment = db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .get();

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (!assessment.completedAt) {
      return NextResponse.json({ error: "Assessment is not yet completed" }, { status: 400 });
    }

    const customer = db
      .select()
      .from(customers)
      .where(eq(customers.id, assessment.customerId))
      .get();

    const conductor = db
      .select()
      .from(users)
      .where(eq(users.id, assessment.conductedBy))
      .get();

    const templateRecord = db
      .select()
      .from(templates)
      .where(eq(templates.slug, assessment.templateId))
      .get();

    const questions = getQuestionsForTemplate(assessment.templateId);

    const answersMap: Record<string, { answer: Answer; notes?: string }> =
      JSON.parse(assessment.answers || "{}");
    const categoryScores: Record<string, number> = JSON.parse(
      assessment.categoryScores || "{}"
    );

    const summary = buildSummary(assessment.overallScore, answersMap, questions);

    const customerName = customer?.name ?? "Unknown Customer";
    const conductorName = conductor?.displayName ?? "Unknown";
    const templateName = templateRecord?.name ?? assessment.templateId;

    const buffer = await renderToBuffer(
      React.createElement(AssessmentReport, {
        customerName,
        conductorName,
        templateName,
        completedAt: assessment.completedAt,
        overallScore: assessment.overallScore,
        categoryScores,
        summary,
        questions,
        answersMap,
      }) as React.ReactElement<DocumentProps>
    );

    log({
      level: "info",
      category: "assessment",
      action: "assessment.pdf_exported",
      userId: session?.userId,
      username: session?.username,
      resourceType: "assessment",
      resourceId: assessmentId,
      metadata: { customerName, templateId: assessment.templateId },
    });

    const filename = `assessment-${safeFilename(customerName)}-${isoDate(assessment.completedAt)}.pdf`;

    const bytes = new Uint8Array(buffer);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    console.error("[assessments/pdf]", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
