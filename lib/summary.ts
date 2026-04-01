import type { Answer } from "./scoring";
import type { Question } from "./scoring";

/**
 * Generates the consultative summary sentence shown on the results page
 * and included in the PDF report. Single source of truth — no duplicated logic.
 */
export function buildSummary(
  score: number,
  answersMap: Record<string, { answer: Answer; notes?: string }>,
  questions: Question[]
): string {
  if (score >= 75) {
    return "Strong security posture. Continue monitoring and consider proactive improvements.";
  }

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
