"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface CustomerRow {
  id: number;
  name: string;
  contactName: string | null;
  latest: {
    overallScore: number;
    completedAt: number | null;
  } | null;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-[#10b981] text-white"
      : score >= 50
      ? "bg-[#f59e0b] text-white"
      : "bg-[#ef4444] text-white";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

type SortKey = "name-asc" | "name-desc" | "date-desc" | "date-asc";

export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q))
      : customers;

    return [...list].sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      const aDate = a.latest?.completedAt ?? 0;
      const bDate = b.latest?.completedAt ?? 0;
      if (sort === "date-desc") return bDate - aDate;
      return aDate - bDate;
    });
  }, [customers, search, sort]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af]"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="date-desc">Latest Assessment (newest)</option>
          <option value="date-asc">Latest Assessment (oldest)</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[#94a3b8] text-center py-8">
          {search ? "No customers match your search." : "No customers yet."}
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
            >
              <div>
                <Link
                  href={`/customers/${c.id}`}
                  className="text-sm font-medium text-[#0f172a] hover:text-[#1e40af] hover:underline"
                >
                  {c.name}
                </Link>
                {c.contactName && (
                  <p className="text-xs text-[#94a3b8] mt-0.5">{c.contactName}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {c.latest ? (
                  <ScoreBadge score={c.latest.overallScore} />
                ) : (
                  <span className="text-xs text-[#94a3b8]">No assessments</span>
                )}
                <Link
                  href={`/assessments/new?customerId=${c.id}`}
                  className="text-xs font-medium text-[#1e40af] hover:underline hidden sm:block"
                >
                  New Assessment
                </Link>
                <Link
                  href={`/customers/${c.id}`}
                  className="text-xs font-medium text-[#94a3b8] hover:text-[#334155]"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {customers.length > 0 && filtered.length < customers.length && (
        <p className="text-xs text-[#94a3b8] mt-2 text-center">
          Showing {filtered.length} of {customers.length} customers
        </p>
      )}
    </div>
  );
}
