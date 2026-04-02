import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers, users, templates } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { buildSummary } from "@/lib/summary";
import { verifyToken } from "@/lib/auth";
import { ScoreCard } from "@/components/assessments/ScoreCard";
import { CategoryBreakdown } from "@/components/assessments/CategoryBreakdown";
import { ExportPDFButton } from "@/components/assessments/ExportPDFButton";
import { DeleteAssessmentButton } from "@/components/assessments/DeleteAssessmentButton";
import type { Question, Answer } from "@/lib/scoring";

type Props = { params: Promise<{ id: string }> };

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function answerBadge(answer: Answer) {
  const styles: Record<Answer, string> = {
    Yes: "bg-[#10b981] text-white",
    No: "bg-[#ef4444] text-white",
    Maybe: "bg-[#f59e0b] text-white",
    "N/A": "bg-neutral-300 text-neutral-700",
  };
  const labels: Record<Answer, string> = {
    Yes: "Yes",
    No: "No",
    Maybe: "Maybe / Partial",
    "N/A": "N/A",
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[answer]}`}
    >
      {labels[answer]}
    </span>
  );
}


export default async function AssessmentResultsPage({ params }: Props) {
  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) notFound();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = sessionCookie ? await verifyToken(sessionCookie).catch(() => null) : null;
  const isAdmin = session?.role === "admin";

  const assessment = db
    .select()
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .get();
  if (!assessment) notFound();

  const customer = db
    .select()
    .from(customers)
    .where(eq(customers.id, assessment.customerId))
    .get();

  const conductor = assessment.conductedBy != null
    ? db.select().from(users).where(eq(users.id, assessment.conductedBy)).get()
    : undefined;

  const questions = getQuestionsForTemplate(assessment.templateId);

  const templateRecord = db
    .select()
    .from(templates)
    .where(eq(templates.slug, assessment.templateId))
    .get();
  const templateLabel = templateRecord?.name ?? assessment.templateId;

  // Parse JSON fields
  const answersMap = JSON.parse(assessment.answers || "{}") as Record<string, { answer: Answer; notes?: string }>;
  const categoryScores: Record<string, number> = JSON.parse(
    assessment.categoryScores || "{}"
  );

  const summary = buildSummary(assessment.overallScore, answersMap, questions);

  // Group questions by category for the answer list
  const byCategory = new Map<string, Question[]>();
  for (const q of questions) {
    if (!byCategory.has(q.category)) byCategory.set(q.category, []);
    byCategory.get(q.category)!.push(q);
  }

  // If not yet completed, this is a draft — show a message
  if (!assessment.completedAt) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-[#94a3b8]">
          This assessment is not yet completed.{" "}
          <Link
            href={`/assessments/${assessmentId}/conduct`}
            className="text-[#1e40af] hover:underline"
          >
            Continue answering questions →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Back */}
      <Link
        href={`/customers/${assessment.customerId}`}
        className="text-sm text-[#94a3b8] hover:text-[#334155]"
      >
        ← {customer?.name ?? "Customer"}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">{templateLabel}</h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            {customer?.name} · Conducted by {conductor?.displayName ?? "—"} ·{" "}
            {formatDate(assessment.completedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            assessmentId={assessmentId}
            filename={`assessment-${(customer?.name ?? "export").replace(/[^a-zA-Z0-9-]/g, "_")}-${assessment.completedAt ? new Date(assessment.completedAt * 1000).toISOString().slice(0, 10) : "draft"}.pdf`}
          />
          {isAdmin && (
            <DeleteAssessmentButton
              assessmentId={assessmentId}
              customerId={assessment.customerId}
            />
          )}
        </div>
      </div>

      {/* Score card */}
      <ScoreCard score={assessment.overallScore} />

      {/* Consultative summary */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-2">
          Landis IT Recommendation
        </h2>
        <p className="text-[#334155] leading-relaxed">{summary}</p>
      </div>

      {/* Category breakdown */}
      {Object.keys(categoryScores).length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">
            Score by Category
          </h2>
          <CategoryBreakdown scores={categoryScores} />
        </div>
      )}

      {/* Full answer list */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
            All Answers
          </h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {Array.from(byCategory.entries()).map(([category, qs]) => (
            <div key={category} className="px-6 py-5">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">
                {category}
              </p>
              <div className="space-y-4">
                {qs.map((q) => {
                  const a = answersMap[q.id];
                  if (!a) return null;
                  return (
                    <div key={q.id} className="flex gap-4">
                      <div className="shrink-0 pt-0.5">
                        {answerBadge(a.answer)}
                      </div>
                      <div>
                        <p className="text-sm text-[#1e293b]">{q.text}</p>
                        {a.notes && (
                          <p className="text-xs text-[#94a3b8] mt-1 italic">
                            {a.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
