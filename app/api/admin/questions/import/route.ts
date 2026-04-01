import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, templates } from "@/lib/db/schema";

interface CsvRow {
  template: string;
  category: string;
  question: string;
  weight: string;
  yes_score: string;
  no_score: string;
  maybe_score: string;
}

// POST /api/admin/questions/import — upload a CSV file to upsert questions
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "CSV parse error", details: parsed.errors.map((e) => e.message) },
        { status: 400 }
      );
    }

    const rows = parsed.data;
    const required = ["template", "category", "question", "weight", "yes_score", "no_score", "maybe_score"];
    const errors: string[] = [];
    let imported = 0;
    let updated = 0;
    const now = Math.floor(Date.now() / 1000);

    // Pre-load templates for fast lookup
    const allTemplates = db.select().from(templates).all();
    const templateMap = new Map(allTemplates.map((t) => [t.slug, t]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      // Validate required columns
      const missing = required.filter((col) => !(col in row) || !String(row[col as keyof CsvRow]).trim());
      if (missing.length > 0) {
        errors.push(`Row ${rowNum}: missing or empty columns: ${missing.join(", ")}`);
        continue;
      }

      const templateSlug = row.template.trim().toLowerCase();
      const template = templateMap.get(templateSlug);
      if (!template) {
        errors.push(`Row ${rowNum}: unknown template "${row.template}" — must be "security" or "onboarding"`);
        continue;
      }

      const weight = parseInt(row.weight, 10);
      if (isNaN(weight) || weight < 1 || weight > 10) {
        errors.push(`Row ${rowNum}: weight must be between 1 and 10 (got "${row.weight}")`);
        continue;
      }

      const yesScore = parseInt(row.yes_score, 10);
      const noScore = parseInt(row.no_score, 10);
      const maybeScore = parseInt(row.maybe_score, 10);

      if ([yesScore, noScore, maybeScore].some((s) => isNaN(s) || s < 0 || s > 100)) {
        errors.push(`Row ${rowNum}: yes_score, no_score, and maybe_score must be 0–100`);
        continue;
      }

      const questionText = row.question.trim();

      // Upsert: match on template + question text
      const existing = db
        .select()
        .from(questions)
        .where(and(eq(questions.templateId, template.id), eq(questions.text, questionText)))
        .get();

      if (existing) {
        db.update(questions)
          .set({ weight, yesScore, noScore, maybeScore, category: row.category.trim() })
          .where(eq(questions.id, existing.id))
          .run();
        updated++;
      } else {
        // Next sortOrder for this template
        const maxRow = db
          .select({ maxOrder: sql<number>`max(sort_order)` })
          .from(questions)
          .where(eq(questions.templateId, template.id))
          .get();

        db.insert(questions)
          .values({
            templateId: template.id,
            category: row.category.trim(),
            text: questionText,
            weight,
            yesScore,
            noScore,
            maybeScore,
            sortOrder: (maxRow?.maxOrder ?? 0) + 1,
            isActive: 1,
            createdAt: now,
          })
          .run();
        imported++;
      }
    }

    return NextResponse.json({ imported, updated, errors });
  } catch (err) {
    console.error("[admin/questions/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
