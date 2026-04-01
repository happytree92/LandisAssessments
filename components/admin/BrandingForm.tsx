"use client";

import { useState } from "react";

const DEFAULTS = {
  color_primary: "#1e40af",
  color_accent: "#0ea5e9",
  color_success: "#10b981",
  color_warning: "#f59e0b",
  color_danger: "#ef4444",
};

const LABELS: Record<string, string> = {
  color_primary: "Primary (buttons, links)",
  color_accent: "Accent (trendline, highlights)",
  color_success: "Success (score ≥ 75)",
  color_warning: "Warning (score 50–74)",
  color_danger: "Danger (score < 50)",
};

interface Props {
  saved: Partial<typeof DEFAULTS>;
}

export function BrandingForm({ saved }: Props) {
  const [colors, setColors] = useState({ ...DEFAULTS, ...saved });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setColors((c) => ({ ...c, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(colors),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
      } else {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 3000);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setColors({ ...DEFAULTS });
  }

  // Preview score value
  const previewScore = 82;
  const scoreColor =
    previewScore >= 75 ? colors.color_success :
    previewScore >= 50 ? colors.color_warning :
    colors.color_danger;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(LABELS).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-[#334155]">{label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colors[key as keyof typeof DEFAULTS]}
                  onChange={(e) => update(key, e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded border border-neutral-300 p-0.5"
                />
                <input
                  type="text"
                  value={colors[key as keyof typeof DEFAULTS]}
                  onChange={(e) => update(key, e.target.value)}
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}
        {savedMsg && (
          <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">Colors saved. Reload the page to see them applied app-wide.</p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors">
            {saving ? "Saving…" : "Save Colors"}
          </button>
          <button type="button" onClick={handleReset} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors">
            Reset to Defaults
          </button>
        </div>
      </form>

      {/* Live preview */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
        <h3 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">Live Preview</h3>

        <div className="flex flex-wrap gap-4 items-start">
          {/* Button */}
          <div className="space-y-1.5">
            <p className="text-xs text-[#94a3b8]">Primary button</p>
            <button
              type="button"
              style={{ backgroundColor: colors.color_primary }}
              className="rounded-md px-4 py-2 text-sm font-medium text-white"
            >
              Start Assessment
            </button>
          </div>

          {/* Score badge */}
          <div className="space-y-1.5">
            <p className="text-xs text-[#94a3b8]">Score badge (82)</p>
            <div
              style={{ backgroundColor: scoreColor }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full text-white text-xl font-bold"
            >
              {previewScore}
            </div>
          </div>

          {/* Status chips */}
          <div className="space-y-1.5">
            <p className="text-xs text-[#94a3b8]">Status colors</p>
            <div className="flex gap-2">
              {[
                { label: "Yes", color: colors.color_success },
                { label: "Maybe", color: colors.color_warning },
                { label: "No", color: colors.color_danger },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  style={{ backgroundColor: color }}
                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Accent */}
          <div className="space-y-1.5">
            <p className="text-xs text-[#94a3b8]">Accent (trendline)</p>
            <div
              style={{ borderColor: colors.color_accent, color: colors.color_accent }}
              className="rounded-md border-2 px-3 py-1 text-sm font-medium"
            >
              Score trending ↑
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
