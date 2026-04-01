"use client";

import { useState, useTransition } from "react";

interface QuestionRow {
  id: number;
  templateSlug: string | null;
  templateName: string | null;
  category: string;
  text: string;
  weight: number;
  yesScore: number;
  noScore: number;
  maybeScore: number;
  sortOrder: number | null;
  isActive: number | null;
}

interface Props {
  initialQuestions: QuestionRow[];
}

export function QuestionsTable({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [, startTransition] = useTransition();

  async function toggleActive(id: number, current: number | null) {
    const next = current === 1 ? 0 : 1;

    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isActive: next } : q))
    );

    startTransition(async () => {
      await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
    });
  }

  // Group by template, then by category
  const byTemplate = new Map<string, { name: string | null; rows: QuestionRow[] }>();
  for (const q of questions) {
    const slug = q.templateSlug ?? "unknown";
    if (!byTemplate.has(slug)) byTemplate.set(slug, { name: q.templateName, rows: [] });
    byTemplate.get(slug)!.rows.push(q);
  }

  return (
    <div className="space-y-8">
      {Array.from(byTemplate.entries()).map(([slug, { name, rows }]) => {
        const byCategory = new Map<string, QuestionRow[]>();
        for (const q of rows) {
          if (!byCategory.has(q.category)) byCategory.set(q.category, []);
          byCategory.get(q.category)!.push(q);
        }

        const active = rows.filter((q) => q.isActive !== 0).length;

        return (
          <div key={slug} className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
            {/* Template header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#0f172a]">{name ?? slug}</h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {active} of {rows.length} questions active
                </p>
              </div>
            </div>

            {/* Questions by category */}
            <div className="divide-y divide-neutral-100">
              {Array.from(byCategory.entries()).map(([category, qs]) => (
                <div key={category}>
                  <div className="px-6 py-2 bg-neutral-50">
                    <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
                      {category}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      {qs.map((q) => {
                        const isActive = q.isActive !== 0;
                        return (
                          <tr
                            key={q.id}
                            className={`transition-colors ${isActive ? "" : "opacity-40"}`}
                          >
                            <td className="px-6 py-3 text-[#1e293b] w-full">{q.text}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-[#94a3b8] text-xs">
                              W: {q.weight}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-[#94a3b8]">
                              Y:{q.yesScore} / N:{q.noScore} / M:{q.maybeScore}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <button
                                onClick={() => toggleActive(q.id, q.isActive)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                  isActive ? "bg-[#1e40af]" : "bg-neutral-300"
                                }`}
                                aria-label={isActive ? "Deactivate" : "Activate"}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                    isActive ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
