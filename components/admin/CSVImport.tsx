"use client";

import { useRef, useState } from "react";

interface ImportResult {
  imported: number;
  updated: number;
  errors: string[];
}

export function CSVImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setUploadError("Please upload a .csv file.");
      return;
    }
    setLoading(true);
    setResult(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Import failed");
      } else {
        setResult(data as ImportResult);
      }
    } catch {
      setUploadError("Network error — import failed.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-[#1e40af] bg-[#dbeafe]"
            : "border-neutral-300 bg-neutral-50 hover:border-[#1e40af] hover:bg-[#f0f7ff]"
        }`}
      >
        <p className="text-sm font-medium text-[#334155]">
          {loading ? "Importing…" : "Drag & drop a CSV file here, or click to browse"}
        </p>
        <p className="text-xs text-[#94a3b8] mt-1">
          Columns required: template, category, question, weight, yes_score, no_score, maybe_score
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Error */}
      {uploadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-[#ef4444] font-medium">{uploadError}</p>
        </div>
      )}

      {/* Import summary */}
      {result && (
        <div className="rounded-md border border-neutral-200 bg-white px-4 py-4 space-y-2 shadow-sm">
          <p className="text-sm font-semibold text-[#0f172a]">Import complete</p>
          <div className="flex gap-6 text-sm">
            <span className="text-[#10b981] font-medium">{result.imported} added</span>
            <span className="text-[#1e40af] font-medium">{result.updated} updated</span>
            {result.errors.length > 0 && (
              <span className="text-[#ef4444] font-medium">{result.errors.length} errors</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-[#ef4444]">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
