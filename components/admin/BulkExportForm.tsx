"use client";

import { useState } from "react";

interface Customer {
  id: number;
  name: string;
}

interface Props {
  customers: Customer[];
}

export function BulkExportForm({ customers }: Props) {
  // Default date range: last 90 days
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);

  const [customerId, setCustomerId] = useState<string>("");
  const [from, setFrom] = useState(ninetyDaysAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ from, to });
    if (customerId) params.set("customerId", customerId);

    try {
      const res = await fetch(`/api/admin/export?${params.toString()}`);

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Export failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessments-export-${to}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error — export failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]";

  return (
    <form onSubmit={handleExport} className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#334155]">
          Customer{" "}
          <span className="text-[#94a3b8] font-normal">(leave blank for all customers)</span>
        </label>
        <select
          className={inputCls}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">From</label>
          <input
            type="date"
            className={inputCls}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">To</label>
          <input
            type="date"
            className={inputCls}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-5 py-2 text-sm font-medium transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating ZIP…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
            </svg>
            Download ZIP
          </>
        )}
      </button>
    </form>
  );
}
