"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  assessmentId: number;
  customerId: number;
}

export function DeleteAssessmentButton({ assessmentId, customerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Delete failed");
        setDeleting(false);
        return;
      }
      router.push(`/customers/${customerId}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Assessment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-[#0f172a] mb-2">Delete Assessment</h2>
            <p className="text-sm text-[#334155] mb-1">
              Are you sure you want to delete this assessment?
            </p>
            <p className="text-sm text-[#94a3b8] mb-5">
              This will permanently remove all answers and scores. This cannot be undone.
            </p>

            {error && (
              <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-[#ef4444] hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
