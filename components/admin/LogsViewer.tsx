"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface LogRow {
  id: number;
  timestamp: number;
  level: string;
  category: string;
  action: string;
  userId: number | null;
  username: string | null;
  ipAddress: string | null;
  resourceType: string | null;
  resourceId: number | null;
  metadata: string | null;
}

interface Props {
  logs: LogRow[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    category: string;
    level: string;
    username: string;
    from: string;
    to: string;
  };
}

// ── Badge helpers ──────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-neutral-100 text-neutral-600",
  warn: "bg-[#f59e0b]/15 text-amber-700",
  error: "bg-[#ef4444]/15 text-red-700",
};

const CATEGORY_STYLES: Record<string, string> = {
  auth: "bg-[#1e40af]/10 text-[#1e40af]",
  access: "bg-[#0ea5e9]/10 text-[#0284c8]",
  token: "bg-purple-100 text-purple-700",
  assessment: "bg-[#10b981]/10 text-[#10b981]",
  customer: "bg-blue-100 text-blue-700",
  user: "bg-orange-100 text-orange-700",
  system: "bg-neutral-100 text-neutral-600",
};

function LevelBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${LEVEL_STYLES[level] ?? "bg-neutral-100 text-neutral-500"}`}>
      {level}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_STYLES[category] ?? "bg-neutral-100 text-neutral-500"}`}>
      {category}
    </span>
  );
}

function formatTs(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

const CATEGORIES = ["auth", "assessment", "customer", "user", "token", "system", "access"];
const LEVELS = ["info", "warn", "error"];

// ── Main component ─────────────────────────────────────────────────

export function LogsViewer({ logs, total, page, totalPages, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Local filter state (only committed on Apply)
  const [category, setCategory] = useState(filters.category);
  const [level, setLevel] = useState(filters.level);
  const [username, setUsername] = useState(filters.username);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  // Build URL with given params
  const buildUrl = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `${pathname}?${params.toString()}`;
  }, [pathname, searchParams]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ category, level, username, from, to, page: "1" }));
  }

  function clearFilters() {
    setCategory(""); setLevel(""); setUsername(""); setFrom(""); setTo("");
    router.push(pathname);
  }

  // Auto-refresh every 30s
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => router.refresh(), 30_000);
    } else if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, router]);

  const inputCls = "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <form onSubmit={applyFilters} className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#94a3b8]">Category</label>
          <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#94a3b8]">Level</label>
          <select className={inputCls} value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">All</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#94a3b8]">Username</label>
          <input
            type="text"
            className={`${inputCls} w-32`}
            placeholder="search…"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#94a3b8]">From</label>
          <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#94a3b8]">To</label>
          <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button type="submit" className="px-4 py-1.5 rounded-md bg-[#1e40af] text-white text-sm font-medium hover:bg-[#1e3a8a] transition-colors">
          Apply
        </button>
        <button type="button" onClick={clearFilters} className="px-4 py-1.5 rounded-md border border-neutral-300 text-sm text-[#334155] hover:bg-neutral-50 transition-colors">
          Clear
        </button>

        {/* Auto-refresh toggle */}
        <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-[#94a3b8]">Auto-refresh (30s)</span>
          <button
            type="button"
            onClick={() => setAutoRefresh(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoRefresh ? "bg-[#1e40af]" : "bg-neutral-300"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoRefresh ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </label>
      </form>

      {/* Result count */}
      <p className="text-xs text-[#94a3b8]">
        {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
        {(category || level || username || from || to) ? " (filtered)" : ""}
      </p>

      {/* Table */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#94a3b8]">No log entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-[#94a3b8] text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium w-40">Time</th>
                <th className="text-left px-4 py-2.5 font-medium w-16">Level</th>
                <th className="text-left px-4 py-2.5 font-medium w-24">Category</th>
                <th className="text-left px-4 py-2.5 font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-medium w-28">User</th>
                <th className="text-left px-4 py-2.5 font-medium w-28">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logs.map(row => (
                <>
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-neutral-50 transition-colors ${expandedId === row.id ? "bg-neutral-50" : ""}`}
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-4 py-2.5 text-[#94a3b8] font-mono text-xs whitespace-nowrap">{formatTs(row.timestamp)}</td>
                    <td className="px-4 py-2.5"><LevelBadge level={row.level} /></td>
                    <td className="px-4 py-2.5"><CategoryBadge category={row.category} /></td>
                    <td className="px-4 py-2.5 text-[#334155] font-mono text-xs">{row.action}</td>
                    <td className="px-4 py-2.5 text-[#334155] text-xs">{row.username ?? <span className="text-[#94a3b8]">—</span>}</td>
                    <td className="px-4 py-2.5 text-[#94a3b8] font-mono text-xs">{row.ipAddress ?? "—"}</td>
                  </tr>
                  {expandedId === row.id && row.metadata && (
                    <tr key={`${row.id}-meta`} className="bg-neutral-50">
                      <td colSpan={6} className="px-4 pb-3 pt-1">
                        <pre className="text-xs text-[#334155] bg-white border border-neutral-200 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(JSON.parse(row.metadata), null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#94a3b8]">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            {page > 1 && (
              <a href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 rounded border border-neutral-200 text-[#334155] hover:bg-neutral-50">← Prev</a>
            )}
            {page < totalPages && (
              <a href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 rounded border border-neutral-200 text-[#334155] hover:bg-neutral-50">Next →</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
