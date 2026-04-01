import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers, users } from "@/lib/db/schema";
import { securityQuestions, onboardingQuestions } from "@/lib/questions";
import { ScoreCard } from "@/components/assessments/ScoreCard";
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
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[answer]}`}
    >
      {answer === "Maybe" ? "Maybe / Partial" : answer}
    </span>
  );
}

// Build the consultative summary based on score and failed questions
function buildSummary(
  score: number,
  answersMap: Record<string, { answer: Answer; notes?: string }>,
  questions: Question[]
): string {
  if (score >= 75) {
    return "Strong security posture. Continue monitoring and consider proactive improvements.";
  }

  // Find failed (No) questions sorted by weight descending
  const failed = questions
    .filter((q) => answersMap[q.id]?.answer === "No")
    .sort((a, b) => b.weight - a.weight);

  if (score < 50) {
    const top3 = failed
      .slice(0, 3)
      .map((q) => q.text)
      .join("; ");
    const suffix = top3
      ? ` Landis IT recommends immediate action on: ${top3}.`
      : "";
    return `Several high-priority gaps were identified.${suffix}`;
  }

  // 50–74
  const partial = questions
    .filter(
      (q) =>
        answersMap[q.id]?.answer === "No" ||
        answersMap[q.id]?.answer === "Maybe"
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((q) => q.category);

  const uniqueCategories = [...new Set(partial)];
  const areas =
    uniqueCategories.length > 0 ? uniqueCategories.join(", ") : "key areas";

  return `Good progress, but key areas need attention. Consider reviewing: ${areas}.`;
}

export default async function AssessmentResultsPage({ params }: Props) {
  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) notFound();

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

  const conductor = db
    .select()
    .from(users)
    .where(eq(users.id, assessment.conductedBy))
    .get();

  const questions =
    assessment.templateId === "security" ? securityQuestions : onboardingQuestions;

  const templateLabel =
    assessment.templateId === "security"
      ? "Security Assessment"
      : "New Customer Onboarding";

  // Parse JSON fields
  const answersMap: Record<string, { answer: Answer; notes?: string }> =
    JSON.parse(assessment.answers || "{}");
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
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">{templateLabel}</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          {customer?.name} · Conducted by {conductor?.displayName ?? "—"} ·{" "}
          {formatDate(assessment.completedAt)}
        </p>
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
          <div className="space-y-4">
            {Object.entries(categoryScores).map(([cat, score]) => {
              const color =
                score >= 75
                  ? "bg-[#10b981]"
                  : score >= 50
                  ? "bg-[#f59e0b]"
                  : "bg-[#ef4444]";
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#334155] font-medium">{cat}</span>
                    <span className="text-[#94a3b8] font-semibold">{score}</span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
