export type Answer = "Yes" | "No" | "Maybe";

export interface Question {
  id: string;
  category: string;
  text: string;
  weight: number; // 1–10; higher = more impact on score
  scores: Record<Answer, number>; // e.g. { Yes: 100, No: 0, Maybe: 50 }
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
