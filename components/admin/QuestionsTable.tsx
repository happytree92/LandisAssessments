"use client";

import { useState, useTransition } from "react";

interface TemplateRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: number | null;
  deletedAt: number | null;
  assessmentCount: number;
}

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
  initialTemplates: TemplateRow[];
  initialQuestions: QuestionRow[];
}

const THIRTY_DAYS_SEC = 30 * 86400;

function daysRemaining(deletedAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, Math.ceil((deletedAt + THIRTY_DAYS_SEC - now) / 86400));
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

export function QuestionsTable({ initialTemplates, initialQuestions }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [questions, setQuestions] = useState(initialQuestions);
  const [, startTransition] = useTransition();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<TemplateRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Question-level toggle ──────────────────────────────────────────

  function toggleQuestionActive(id: number, current: number | null) {
    const next = current === 1 ? 0 : 1;
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isActive: next } : q)));
    startTransition(async () => {
      await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
    });
  }

  // ── Template-level actions ─────────────────────────────────────────

  async function patchTemplate(
    template: TemplateRow,
    body: Record<string, unknown>,
    optimistic: Partial<TemplateRow>
  ) {
    setError(null);
    setActionLoading(template.id);
    // Apply optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, ...optimistic } : t))
    );
    try {
      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // Revert
        setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
        const d = await res.json();
        setError(d.error ?? "Failed to update template");
      }
    } catch {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
      setError("Network error — please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  function toggleVisibility(template: TemplateRow) {
    const next = template.isActive === 1 ? 0 : 1;
    patchTemplate(template, { isActive: next }, { isActive: next });
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    const now = Math.floor(Date.now() / 1000);
    await patchTemplate(target, { softDelete: true }, { deletedAt: now });
  }

  async function recoverTemplate(template: TemplateRow) {
    await patchTemplate(template, { recover: true }, { deletedAt: null });
  }

  async function permanentlyDeleteTemplate() {
    if (!confirmHardDelete) return;
    const target = confirmHardDelete;
    setConfirmHardDelete(null);
    setError(null);
    setActionLoading(target.id);
    try {
      const res = await fetch(`/api/admin/templates/${target.id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== target.id));
        setQuestions((prev) => prev.filter((q) => q.templateSlug !== target.slug));
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to permanently delete template");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Grouping ───────────────────────────────────────────────────────

  const liveTemplates = templates.filter((t) => t.deletedAt === null);
  const deletedTemplates = templates.filter((t) => t.deletedAt !== null);

  const questionsBySlug = new Map<string, QuestionRow[]>();
  for (const q of questions) {
    const slug = q.templateSlug ?? "unknown";
    if (!questionsBySlug.has(slug)) questionsBySlug.set(slug, []);
    questionsBySlug.get(slug)!.push(q);
  }

  // ── Render helpers ─────────────────────────────────────────────────

  function renderTemplateCard(template: TemplateRow, isDeleted: boolean) {
    const qs = questionsBySlug.get(template.slug) ?? [];
    const byCategory = new Map<string, QuestionRow[]>();
    for (const q of qs) {
      if (!byCategory.has(q.category)) byCategory.set(q.category, []);
      byCategory.get(q.category)!.push(q);
    }
    const activeCount = qs.filter((q) => q.isActive !== 0).length;
    const isLoading = actionLoading === template.id;
    const isActive = template.isActive === 1;

    return (
      <div
        key={template.id}
        className={`rounded-lg border shadow-sm overflow-hidden ${
          isDeleted ? "border-red-200" : "border-neutral-200 bg-white"
        }`}
      >
        {/* Template header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-4 ${
            isDeleted ? "bg-red-50 border-red-100" : "border-neutral-100 bg-white"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-[#0f172a]">{template.name}</h2>

              {isDeleted ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                  Deleted — {daysRemaining(template.deletedAt!)}d to recover
                </span>
              ) : (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isActive ? "Active" : "Draft"}
                </span>
              )}

              {template.assessmentCount > 0 && (
                <span className="text-xs text-[#94a3b8]">
                  {template.assessmentCount}{" "}
                  {template.assessmentCount === 1 ? "assessment" : "assessments"}
                </span>
              )}
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5 font-mono">{template.slug}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isDeleted ? (
              <>
                <button
                  onClick={() => recoverTemplate(template)}
                  disabled={isLoading}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-[#334155] hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? "…" : "Recover"}
                </button>
                <button
                  onClick={() => setConfirmHardDelete(template)}
                  disabled={isLoading}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-[#ef4444] hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Permanently Delete
                </button>
              </>
            ) : (
              <>
                {/* Visibility toggle */}
                <button
                  onClick={() => toggleVisibility(template)}
                  disabled={isLoading}
                  title={isActive ? "Set to Draft (hide from assessments)" : "Set to Active (show in assessments)"}
                  aria-label={isActive ? "Set template to draft" : "Set template to active"}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                    isActive ? "bg-[#1e40af]" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      isActive ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>

                {/* Delete button */}
                <button
                  onClick={() => setConfirmDelete(template)}
                  disabled={isLoading}
                  title="Delete template"
                  aria-label="Delete template"
                  className="text-[#94a3b8] hover:text-[#ef4444] disabled:opacity-50 transition-colors"
                >
                  <TrashIcon />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Questions */}
        {qs.length === 0 ? (
          <div className="px-6 py-4 text-xs text-[#94a3b8]">No questions added yet.</div>
        ) : (
          <>
            <div className="px-6 py-2 border-b border-neutral-100 bg-neutral-50">
              <p className="text-xs text-[#94a3b8]">
                {activeCount} of {qs.length} questions active
              </p>
            </div>
            <div className={`divide-y divide-neutral-100 ${isDeleted ? "opacity-50" : ""}`}>
              {Array.from(byCategory.entries()).map(([category, catQs]) => (
                <div key={category}>
                  <div className="px-6 py-2 bg-neutral-50">
                    <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
                      {category}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      {catQs.map((q) => {
                        const qActive = q.isActive !== 0;
                        return (
                          <tr
                            key={q.id}
                            className={`transition-colors ${qActive ? "" : "opacity-40"}`}
                          >
                            <td className="px-6 py-3 text-[#1e293b] w-full">{q.text}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-[#94a3b8] text-xs">
                              W: {q.weight}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-[#94a3b8]">
                              Y:{q.yesScore} / N:{q.noScore} / M:{q.maybeScore}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {!isDeleted && (
                                <button
                                  onClick={() => toggleQuestionActive(q.id, q.isActive)}
                                  aria-label={qActive ? "Deactivate question" : "Activate question"}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                    qActive ? "bg-[#1e40af]" : "bg-neutral-300"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                      qActive ? "translate-x-4" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-4 py-2">
          {error}
        </p>
      )}

      {/* Active / Draft templates */}
      {liveTemplates.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm px-6 py-10 text-center text-sm text-[#94a3b8]">
          No templates yet. Create one above.
        </div>
      ) : (
        <div className="space-y-8">
          {liveTemplates.map((t) => renderTemplateCard(t, false))}
        </div>
      )}

      {/* Soft-deleted templates (within recovery window) */}
      {deletedTemplates.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest pt-2">
            Recently Deleted
          </p>
          <div className="space-y-4">
            {deletedTemplates.map((t) => renderTemplateCard(t, true))}
          </div>
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {confirmHardDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmHardDelete(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-[#0f172a] mb-2">Permanently Delete Template</h2>
            <p className="text-sm text-[#334155] mb-4">
              Permanently delete{" "}
              <span className="font-semibold">{confirmHardDelete.name}</span>{" "}
              and all its questions?
            </p>
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 mb-5 text-sm text-red-800">
              <p className="font-semibold mb-1">This cannot be undone</p>
              <p>
                The template slug <code className="font-mono bg-red-100 px-1 rounded">{confirmHardDelete.slug}</code> will
                be freed up immediately so you can recreate it via CSV import.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmHardDelete(null)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={permanentlyDeleteTemplate}
                className="rounded-md bg-[#ef4444] hover:bg-red-600 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft-delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-[#0f172a] mb-2">Delete Template</h2>
            <p className="text-sm text-[#334155] mb-3">
              Delete{" "}
              <span className="font-semibold">{confirmDelete.name}</span>?
            </p>

            {confirmDelete.assessmentCount > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">This template is in use</p>
                <p>
                  {confirmDelete.assessmentCount}{" "}
                  {confirmDelete.assessmentCount === 1 ? "assessment references" : "assessments reference"}{" "}
                  this template. Existing assessments will not be affected, but the template
                  will no longer be available for new assessments.
                </p>
              </div>
            )}

            <p className="text-sm text-[#94a3b8] mb-5">
              The template will be soft-deleted and can be recovered within 30 days. After
              that it is permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndDelete}
                className="rounded-md bg-[#ef4444] hover:bg-red-600 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
