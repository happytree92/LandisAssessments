"use client";

import { useState } from "react";

interface Props {
  saved: string;
}

export function BaseUrlForm({ saved }: Props) {
  const [baseUrl, setBaseUrl] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_url: baseUrl.trim() }),
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

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#334155]">
          Base URL / Domain
        </label>
        <p className="text-xs text-[#94a3b8]">
          The public-facing URL of this app (e.g. <span className="font-mono">https://assess.mycompany.com</span>).
          Used when generating shareable customer assessment links.
        </p>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://assess.mycompany.com"
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
        />
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {savedMsg && (
        <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">Base URL saved. New share links will use this domain.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save URL"}
      </button>
    </form>
  );
}
