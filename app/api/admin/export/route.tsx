import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { assessments, customers, users, templates, settings } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { buildSummary } from "@/lib/summary";
import { AssessmentReport } from "@/components/pdf/AssessmentReport";
import type { Answer } from "@/lib/scoring";

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 40);
}

function isoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function dateToUnixStart(dateStr: string): number {
  // Parse YYYY-MM-DD as the start of that day (UTC midnight)
  return Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
}

function dateToUnixEnd(dateStr: string): number {
  // Parse YYYY-MM-DD as the end of that day (UTC 23:59:59)
  return Math.floor(new Date(`${dateStr}T23:59:59Z`).getTime() / 1000);
}

// GET /api/admin/export?customerId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns a ZIP archive of PDF reports for all matching completed assessments.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = req.nextUrl;
    const customerIdParam = searchParams.get("customerId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: "from and to date params are required" }, { status: 400 });
    }

    const fromUnix = dateToUnixStart(fromParam);
    const toUnix = dateToUnixEnd(toParam);

    // Build the filter conditions
    const conditions = [
      isNotNull(assessments.completedAt),
      gte(assessments.completedAt, fromUnix),
      lte(assessments.completedAt, toUnix),
    ];

    if (customerIdParam) {
      const cid = parseInt(customerIdParam, 10);
      if (!isNaN(cid)) conditions.push(eq(assessments.customerId, cid));
    }

    const rows = db
      .select()
      .from(assessments)
      .where(and(...conditions))
      .all();

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No completed assessments found for the selected filters." },
        { status: 404 }
      );
    }

    const settingsRows = db.select().from(settings).all();
    const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    const orgName = settingsMap["org_name"]?.trim() || "Landis Assessments";
    const orgLogo = settingsMap["org_logo"] || null;

    const zip = new JSZip();

    for (const assessment of rows) {
      if (!assessment.completedAt) continue;

      const customer = db.select().from(customers).where(eq(customers.id, assessment.customerId)).get();
      const conductor = db.select().from(users).where(eq(users.id, assessment.conductedBy)).get();
      const templateRecord = db.select().from(templates).where(eq(templates.slug, assessment.templateId)).get();

      const questions = getQuestionsForTemplate(assessment.templateId);

      const answersMap: Record<string, { answer: Answer; notes?: string }> =
        JSON.parse(assessment.answers || "{}");
      const categoryScores: Record<string, number> = JSON.parse(
        assessment.categoryScores || "{}"
      );

      const customerName = customer?.name ?? "Unknown";
      const conductorName = conductor?.displayName ?? "Unknown";
      const templateName = templateRecord?.name ?? assessment.templateId;
      const summary = buildSummary(assessment.overallScore, answersMap, questions);

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
          orgName,
          orgLogo,
        }) as React.ReactElement<DocumentProps>
      );

      const filename = `assessment-${safeFilename(customerName)}-${isoDate(assessment.completedAt)}.pdf`;
      zip.file(filename, buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipFilename = `assessments-export-${isoDate(Math.floor(Date.now() / 1000))}.zip`;
    const zipBytes = new Uint8Array(zipBuffer);

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBytes.byteLength),
      },
    });
  } catch (err) {
    console.error("[admin/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
