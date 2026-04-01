"use client";

import { useState } from "react";

interface Props {
  assessmentId: number;
  filename: string; // suggested download filename
}

export function ExportPDFButton({ assessmentId, filename }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/pdf`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-[#334155] shadow-sm hover:bg-neutral-50 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-[#1e40af]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
            </svg>
            Export PDF
          </>
        )}
      </button>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
