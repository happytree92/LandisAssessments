import { describe, expect, it } from "vitest";
import { calculateScore, type Question } from "./scoring";

function question(
  id: string,
  category: string,
  weight: number,
  scores: Question["scores"] = { Yes: 100, No: 0, Maybe: 50 }
): Question {
  return { id, category, text: `Question ${id}`, weight, scores };
}

describe("calculateScore", () => {
  it("weights each answer by its question's weight and rounds", () => {
    const questions = [question("a", "Access", 10), question("b", "Access", 5)];

    const result = calculateScore(
      [
        { questionId: "a", answer: "Yes" },
        { questionId: "b", answer: "No" },
      ],
      questions
    );

    // (10 × 100 + 5 × 0) / (15 × 100) = 66.7%
    expect(result.overall).toBe(67);
  });

  it("uses the question's own score for the chosen answer", () => {
    const questions = [question("a", "Access", 3, { Yes: 90, No: 10, Maybe: 40 })];

    expect(calculateScore([{ questionId: "a", answer: "Maybe" }], questions).overall).toBe(40);
  });

  it("scores each category from its own questions only", () => {
    const questions = [
      question("a", "Access", 4),
      question("b", "Access", 4),
      question("c", "Backup", 2),
    ];

    const result = calculateScore(
      [
        { questionId: "a", answer: "Yes" },
        { questionId: "b", answer: "Maybe" },
        { questionId: "c", answer: "No" },
      ],
      questions
    );

    expect(result.categories).toEqual({ Access: 75, Backup: 0 });
    // (4 × 100 + 4 × 50 + 2 × 0) / (10 × 100)
    expect(result.overall).toBe(60);
  });

  it("leaves N/A answers out of the overall and category scores", () => {
    const questions = [
      question("a", "Access", 10),
      question("b", "Access", 10),
      question("c", "Backup", 5),
    ];

    const result = calculateScore(
      [
        { questionId: "a", answer: "Yes" },
        { questionId: "b", answer: "N/A" },
        { questionId: "c", answer: "N/A" },
      ],
      questions
    );

    expect(result).toEqual({ overall: 100, categories: { Access: 100 } });
  });

  it("returns 0 with no categories when nothing is scorable", () => {
    const questions = [question("a", "Access", 10)];

    expect(calculateScore([], questions)).toEqual({ overall: 0, categories: {} });
    expect(calculateScore([{ questionId: "a", answer: "N/A" }], questions)).toEqual({
      overall: 0,
      categories: {},
    });
  });

  it("ignores answers to questions that are not in the template", () => {
    const questions = [question("a", "Access", 10)];

    const result = calculateScore(
      [
        { questionId: "a", answer: "Yes" },
        { questionId: "retired-question", answer: "No" },
      ],
      questions
    );

    expect(result).toEqual({ overall: 100, categories: { Access: 100 } });
  });
});
