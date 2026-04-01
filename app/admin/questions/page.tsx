import { db } from "@/lib/db";
import { questions, templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { QuestionsTable } from "@/components/admin/QuestionsTable";
import { CSVImport } from "@/components/admin/CSVImport";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage() {
  const rows = db
    .select({
      id: questions.id,
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Question Library</h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            Manage assessment questions. Toggle active state or bulk-update via CSV import.
          </p>
        </div>
        <a
          href="/api/admin/questions/export"
          className="inline-flex items-center gap-2 rounded-md bg-white border border-neutral-200 px-4 py-2 text-sm font-medium text-[#334155] shadow-sm hover:bg-neutral-50 transition-colors"
        >
          Download CSV
        </a>
      </div>

      {/* CSV Import */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">
          Import / Update via CSV
        </h2>
        <CSVImport />
        <p className="text-xs text-[#94a3b8] mt-3">
          Don't have a template?{" "}
          <a
            href="/sample-questions.csv"
            download
            className="text-[#1e40af] hover:underline"
          >
            Download sample-questions.csv
          </a>
        </p>
      </div>

      {/* Questions table */}
      <QuestionsTable initialQuestions={rows} />
    </div>
  );
}
