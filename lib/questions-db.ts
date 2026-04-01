import { eq } from "drizzle-orm";
import { db } from "./db";
import { questions, templates } from "./db/schema";
import type { Question } from "./scoring";

/**
 * Fetch active questions for a given template slug ("security" | "onboarding")
 * and convert them to the Question shape expected by calculateScore.
 * The question's DB integer id is used as a string id so assessments can
 * store answers keyed by "1", "2", etc.
 */
export function getQuestionsForTemplate(templateSlug: string): Question[] {
  const template = db
    .select()
    .from(templates)
    .where(eq(templates.slug, templateSlug))
    .get();

  if (!template) return [];

  const rows = db
    .select()
    .from(questions)
    .where(eq(questions.templateId, template.id))
    .orderBy(questions.sortOrder)
    .all();

  return rows
    .filter((q) => q.isActive !== 0)
    .map((q) => ({
      id: q.id.toString(),
      category: q.category,
      text: q.text,
      weight: q.weight,
      scores: {
        Yes: q.yesScore,
        No: q.noScore,
        Maybe: q.maybeScore,
      },
    }));
}
