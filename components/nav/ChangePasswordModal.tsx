"use client";

import { useState } from "react";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError("New passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change password");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white shadow-lg mx-4">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0f172a]">Change Password</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#334155] text-lg leading-none">×</button>
        </div>

        {success ? (
          <div className="px-6 py-6 space-y-4">
            <p className="text-sm text-[#10b981]">Password changed successfully.</p>
            <button onClick={onClose} className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-4 py-2 text-sm font-medium">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#334155]">Current Password</label>
              <input className={inputCls} type="password" value={form.currentPassword} onChange={(e) => update("currentPassword", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#334155]">New Password</label>
              <input className={inputCls} type="password" value={form.newPassword} onChange={(e) => update("newPassword", e.target.value)} placeholder="min. 8 characters" required />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#334155]">Confirm New Password</label>
              <input className={inputCls} type="password" value={form.confirm} onChange={(e) => update("confirm", e.target.value)} required />
            </div>

            {error && (
              <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={loading} className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors">
                {loading ? "Saving…" : "Change Password"}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
