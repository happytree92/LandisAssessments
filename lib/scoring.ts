export type Answer = "Yes" | "No" | "Maybe" | "N/A";

export interface Question {
  id: string;
  category: string;
  text: string;
  weight: number; // 1–10; higher = more impact on score
  scores: Record<"Yes" | "No" | "Maybe", number>; // N/A is excluded from scoring
}

export interface AssessmentResult {
  questionId: string;
  answer: Answer;
  notes?: string;
}

export function calculateScore(
  results: AssessmentResult[],
  questions: Question[]
): { overall: number; categories: Record<string, number> } {
  let totalWeighted = 0;
  let totalWeight = 0;
  const categoryScores: Record<string, { score: number; max: number }> = {};

  results.forEach((r) => {
    // N/A answers are excluded from score calculations entirely
    if (r.answer === "N/A") return;

    const q = questions.find((q) => q.id === r.questionId);
    if (!q) return;
    const compliance = q.scores[r.answer] ?? 50;
    totalWeighted += q.weight * compliance;
    totalWeight += q.weight * 100;

    if (!categoryScores[q.category])
      categoryScores[q.category] = { score: 0, max: 0 };
    categoryScores[q.category].score += q.weight * compliance;
    categoryScores[q.category].max += q.weight * 100;
  });

  const overall =
    totalWeight === 0 ? 0 : Math.round((totalWeighted / totalWeight) * 100);

  const categories = Object.fromEntries(
    Object.entries(categoryScores).map(([cat, data]) => [
      cat,
      Math.round((data.score / data.max) * 100),
    ])
  );

  return { overall, categories };
}
