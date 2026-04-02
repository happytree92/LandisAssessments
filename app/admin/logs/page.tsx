export const dynamic = "force-dynamic";

import { and, eq, gte, lte, like, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, settings } from "@/lib/db/schema";
import { LogsViewer } from "@/components/admin/LogsViewer";
import { LogRetentionForm } from "@/components/admin/LogRetentionForm";
import { purgeOldLogs, parseRetentionDays } from "@/lib/log-retention";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

const RETENTION_LABELS: Record<number, string> = {
  30: "30 days",
  90: "90 days",
  365: "1 year",
};

export default async function AdminLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  // ── Retention: read setting, purge, then filter query ──────────────
  const settingsRows = db.select().from(settings).all();
  const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const retentionDays = parseRetentionDays(settingsMap["log_retention_days"]);
  const retentionCutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;

  purgeOldLogs(retentionDays);

  // ── User filters ────────────────────────────────────────────────────
  const category = str(sp.category);
  const level = str(sp.level);
  const username = str(sp.username);
  const from = str(sp.from);
  const to = str(sp.to);
  const page = Math.max(1, parseInt(str(sp.page) || "1", 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  // Retention cutoff is always applied; user filters are additive
  const conditions = [gte(activityLogs.timestamp, retentionCutoff)];
  if (category) conditions.push(eq(activityLogs.category, category));
  if (level) conditions.push(eq(activityLogs.level, level));
  if (username) conditions.push(like(activityLogs.username, `%${username}%`));
  if (from) {
    const fromUnix = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    if (!isNaN(fromUnix)) conditions.push(gte(activityLogs.timestamp, fromUnix));
  }
  if (to) {
    const toUnix = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);
    if (!isNaN(toUnix)) conditions.push(lte(activityLogs.timestamp, toUnix));
  }

  const where = and(...conditions);

  const countResult = db.select({ total: sql<number>`count(*)` }).from(activityLogs).where(where).get();
  const total = countResult?.total ?? 0;

  const rows = db
    .select()
    .from(activityLogs)
    .where(where)
    .orderBy(desc(activityLogs.timestamp))
    .limit(limit)
    .offset(offset)
    .all();

  const retentionLabel = RETENTION_LABELS[retentionDays] ?? `${retentionDays} days`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Activity Logs</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          All recorded events — auth, assessments, customers, users, tokens. Newest first.
        </p>
      </div>

      {/* Retention setting */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#334155]">Log Retention</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Logs older than the selected period are purged automatically.
            Currently keeping{" "}
            <span className="font-semibold text-[#334155]">{retentionLabel}</span>.
          </p>
        </div>
        <LogRetentionForm current={retentionDays} />
      </div>

      <LogsViewer
        logs={rows}
        total={total}
        page={page}
        totalPages={Math.ceil(total / limit)}
        filters={{ category, level, username, from, to }}
      />
    </div>
  );
}
