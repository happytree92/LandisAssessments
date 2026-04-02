"use client";

import { useState } from "react";

interface Props {
  saved: string; // current comma-separated value from DB
}

export function IpAllowlistForm({ saved }: Props) {
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse the current list for display
  const currentIps = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_ip_allowlist: value.trim() }),
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
          Admin IP Allowlist
        </label>
        <p className="text-xs text-[#94a3b8]">
          When configured, admin accounts can only log in from these IP addresses.
          Leave empty to allow logins from any IP.
          Enter comma-separated IPs (e.g.{" "}
          <span className="font-mono">203.0.113.10, 198.51.100.5</span>).
        </p>
        {currentIps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {currentIps.map((ip) => (
              <span
                key={ip}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono rounded"
              >
                {ip}
              </span>
            ))}
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="203.0.113.10, 198.51.100.5"
          rows={2}
          className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e40af] resize-none"
        />
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Warning: if you save an allowlist that does not include your current IP, you will
          be locked out of admin logins. Make sure your IP is included before saving.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {savedMsg && (
        <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">
          IP allowlist saved.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save Allowlist"}
      </button>
    </form>
  );
}
