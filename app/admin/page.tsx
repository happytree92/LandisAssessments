export const dynamic = "force-dynamic";

import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, assessments, users, settings } from "@/lib/db/schema";
import { parseRetentionDays } from "@/lib/log-retention";

function StatCard({
  label,
  value,
  sublabel,
  href,
  danger,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
  danger?: boolean;
}) {
  const content = (
    <div className={`rounded-lg border shadow-sm p-5 bg-white ${danger ? "border-red-200" : "border-neutral-200"}`}>
      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold ${danger ? "text-[#ef4444]" : "text-[#0f172a]"}`}>{value}</p>
      {sublabel && <p className="text-xs text-[#94a3b8] mt-1">{sublabel}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function AdminDashboardPage() {
  const nowSec = Math.floor(Date.now() / 1000);
  const last24h = nowSec - 86400;
  const last7d = nowSec - 7 * 86400;
  const thisWeekStart = nowSec - 7 * 86400;

  // Failed logins last 24h
  const failedLogins = db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.category, "auth"),
        eq(activityLogs.action, "login.failed"),
        gte(activityLogs.timestamp, last24h)
      )
    )
    .get()?.count ?? 0;

  // Assessments completed this week
  const assessmentsThisWeek = db
    .select({ count: sql<number>`count(*)` })
    .from(assessments)
    .where(gte(assessments.completedAt, thisWeekStart))
    .get()?.count ?? 0;

  // Invalid token attempts last 7 days
  const invalidTokenAttempts = db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.category, "token"),
        eq(activityLogs.action, "token.invalid_access"),
        gte(activityLogs.timestamp, last7d)
      )
    )
    .get()?.count ?? 0;

  // Last startup time
  const lastStartup = db
    .select({ timestamp: activityLogs.timestamp })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.category, "system"),
        eq(activityLogs.action, "system.startup")
      )
    )
    .orderBy(activityLogs.timestamp)
    .all()
    .at(-1);

  const startupTime = lastStartup
    ? new Date(lastStartup.timestamp * 1000).toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
        hour12: false,
      })
    : "Unknown";

  // Log retention setting
  const settingsRows = db.select().from(settings).all();
  const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const retentionDays = parseRetentionDays(settingsMap["log_retention_days"]);
  const retentionLabel = retentionDays === 365 ? "1 year" : `${retentionDays} days`;

  // Active / total users
  const allUsers = db.select({ isActive: users.isActive }).from(users).all();
  const activeUsers = allUsers.filter(u => u.isActive !== 0).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Admin Dashboard</h1>
        <p className="text-sm text-[#94a3b8] mt-1">System overview and recent activity summary.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Failed Logins (24h)"
          value={failedLogins}
          sublabel="Unique attempts"
          href="/admin/logs?category=auth&level=warn"
          danger={failedLogins > 3}
        />
        <StatCard
          label="Assessments (7d)"
          value={assessmentsThisWeek}
          sublabel="Completed this week"
          href="/admin/logs?category=assessment"
        />
        <StatCard
          label="Invalid Token Attempts (7d)"
          value={invalidTokenAttempts}
          sublabel="Public link attempts"
          href="/admin/logs?category=token&level=warn"
          danger={invalidTokenAttempts > 5}
        />
        <StatCard
          label="Active Users"
          value={`${activeUsers} / ${allUsers.length}`}
          sublabel="Active / total staff"
          href="/admin/users"
        />
      </div>

      {/* System info */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">System</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="text-[#94a3b8] w-36 shrink-0">Last startup</dt>
            <dd className="text-[#334155] font-mono">{startupTime}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-[#94a3b8] w-36 shrink-0">Log retention</dt>
            <dd className="text-[#334155]">{retentionLabel}</dd>
          </div>
        </dl>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/logs"
          className="inline-flex items-center gap-2 rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
          </svg>
          View All Logs
        </Link>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 text-[#334155] hover:bg-neutral-50 px-4 py-2 text-sm font-medium transition-colors"
        >
          Users
        </Link>
        <Link
          href="/admin/export"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 text-[#334155] hover:bg-neutral-50 px-4 py-2 text-sm font-medium transition-colors"
        >
          Bulk Export
        </Link>
      </div>
    </div>
  );
}
