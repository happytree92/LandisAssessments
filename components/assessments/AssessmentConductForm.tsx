"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Question, Answer } from "@/lib/scoring";

interface AnswerState {
  answer: Answer | undefined;
  notes: string;
}

interface AssessmentConductFormProps {
  assessmentId: number;
  questions: Question[];
  customerName: string;
  templateLabel: string;
}

// Group questions by category, preserving declaration order
function groupByCategory(questions: Question[]): [string, Question[]][] {
  const map = new Map<string, Question[]>();
  for (const q of questions) {
    if (!map.has(q.category)) map.set(q.category, []);
    map.get(q.category)!.push(q);
  }
  return Array.from(map.entries());
}

const ANSWER_OPTIONS: { value: Answer; label: string; color: string }[] = [
  {
    value: "Yes",
    label: "Yes",
    color:
      "border-[#10b981] bg-[#10b981] text-white data-[selected=false]:bg-white data-[selected=false]:text-[#10b981]",
  },
  {
    value: "No",
    label: "No",
    color:
      "border-[#ef4444] bg-[#ef4444] text-white data-[selected=false]:bg-white data-[selected=false]:text-[#ef4444]",
  },
  {
    value: "Maybe",
    label: "Maybe / Partial",
    color:
      "border-[#f59e0b] bg-[#f59e0b] text-white data-[selected=false]:bg-white data-[selected=false]:text-[#f59e0b]",
  },
];

export function AssessmentConductForm({
  assessmentId,
  questions,
  customerName,
  templateLabel,
}: AssessmentConductFormProps) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(
    Object.fromEntries(
      questions.map((q) => [q.id, { answer: undefined, notes: "" }])
    )
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const answeredCount = Object.values(answers).filter(
    (a) => a.answer !== undefined
  ).length;
  const totalCount = questions.length;
  const progressPct = Math.round((answeredCount / totalCount) * 100);
  const allAnswered = answeredCount === totalCount;

  function setAnswer(questionId: string, answer: Answer) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], answer },
    }));
  }

  function setNotes(questionId: string, notes: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], notes },
    }));
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setError("");
    setLoading(true);

    // Build the answers payload for the API
    const payload: Record<string, { answer: string; notes?: string }> = {};
    for (const [qId, state] of Object.entries(answers)) {
      payload[qId] = {
        answer: state.answer as string,
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      };
    }

    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to save assessment");
        return;
      }

      router.push(`/assessments/${assessmentId}`);
      router.refresh();
    } catch {
      setError("Unable to save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const categories = groupByCategory(questions);

  return (
    <div className="max-w-3xl">
      {/* Sticky progress bar */}
      <div className="sticky top-0 z-10 bg-[#f8fafc] pt-2 pb-4 mb-6 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium text-[#334155]">
              {customerName} — {templateLabel}
            </span>
          </div>
          <span className="text-sm text-[#94a3b8]">
            {answeredCount} / {totalCount} answered
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Questions by category */}
      <div className="space-y-10">
        {categories.map(([category, qs]) => (
          <section key={category}>
            <h2 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest mb-4">
              {category}
            </h2>
            <div className="space-y-6">
              {qs.map((q, idx) => {
                const state = answers[q.id];
                const isHighImpact = q.weight >= 8;
                const answered = state.answer !== undefined;

                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-5 transition-colors ${
                      answered
                        ? "border-neutral-200 bg-white"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    {/* Question header */}
                    <div className="flex items-start gap-3 mb-4">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-100 text-neutral-500 text-xs flex items-center justify-center font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#0f172a] leading-relaxed">
                          {q.text}
                        </p>
                        <span
                          className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isHighImpact
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {isHighImpact ? "High Impact" : "Medium Impact"}
                        </span>
                      </div>
                    </div>

                    {/* Yes / No / Maybe buttons */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      {ANSWER_OPTIONS.map((opt) => {
                        const selected = state.answer === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAnswer(q.id, opt.value)}
                            className={`px-4 py-1.5 rounded-full border-2 text-sm font-medium transition-all ${
                              selected
                                ? opt.color.split(" data-[selected=false]:")[0]
                                : `border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400`
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional notes */}
                    <textarea
                      placeholder="Notes (optional)…"
                      value={state.notes}
                      onChange={(e) => setNotes(q.id, e.target.value)}
                      rows={2}
                      className="w-full text-sm rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#1e40af] resize-none"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Save & Complete */}
      <div className="mt-10 pt-6 border-t border-neutral-200">
        {error && (
          <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
            {error}
          </p>
        )}
        {!allAnswered && (
          <p className="text-sm text-[#94a3b8] mb-4">
            Answer all {totalCount} questions to enable submission.{" "}
            {totalCount - answeredCount} remaining.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-8"
          size="lg"
        >
          {loading ? "Saving…" : "Save & Complete Assessment"}
        </Button>
      </div>
    </div>
  );
}
