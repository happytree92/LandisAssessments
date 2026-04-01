"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddUserForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    password: "",
    role: "staff",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
      } else {
        router.refresh();
        onClose();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">Display Name</label>
          <input className={inputCls} value={form.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="Jane Smith" required />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">Username</label>
          <input className={inputCls} value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="jsmith" required />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">Password</label>
          <input className={inputCls} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="min. 8 characters" required />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">Role</label>
          <select className={inputCls} value={form.role} onChange={(e) => update("role", e.target.value)}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors">
          {loading ? "Creating…" : "Create User"}
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
