export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { isNotNull, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, assessments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreTrendline } from "@/components/dashboard/ScoreTrendline";

function startOfMonthUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

/** Build monthly average score data for the last 6 months.
 *  For each month: find the most recent assessment per customer that falls
 *  within that month, then average across all customers that had one. */
function buildMonthlyTrend(
  completedAssessments: { customerId: number; overallScore: number; completedAt: number | null }[]
): { label: string; score: number | null }[] {
  const now = new Date();
  const months: { label: string; score: number | null }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = Math.floor(d.getTime() / 1000);
    const monthEnd = Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000);
    const label = d.toLocaleDateString("en-US", { month: "short" });

    const inMonth = completedAssessments.filter(
      (a) => a.completedAt !== null && a.completedAt >= monthStart && a.completedAt <= monthEnd
    );

    if (inMonth.length === 0) {
      months.push({ label, score: null });
      continue;
    }

    const latestPerCustomer = new Map<number, { score: number; completedAt: number }>();
    for (const a of inMonth) {
      if (a.completedAt === null) continue;
      const existing = latestPerCustomer.get(a.customerId);
      if (!existing || a.completedAt > existing.completedAt) {
        latestPerCustomer.set(a.customerId, { score: a.overallScore, completedAt: a.completedAt });
      }
    }

    const scores = Array.from(latestPerCustomer.values()).map((v) => v.score);
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    months.push({ label, score: avg });
  }

  return months;
}

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function templateLabel(templateId: string): string {
  if (templateId === "security") return "Security Assessment";
  if (templateId === "onboarding") return "Onboarding Assessment";
  return templateId;
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

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  let displayName = "there";
  if (token) {
    try {
      const payload = await verifyToken(token);
      displayName = payload.displayName;
    } catch {
      // use fallback
    }
  }

  const customerCount = db.select().from(customers).all().length;

  const completedAssessments = db
    .select()
    .from(assessments)
    .where(isNotNull(assessments.completedAt))
    .all();

  const thisMonthStart = startOfMonthUnix();
  const assessmentsThisMonth = completedAssessments.filter(
    (a) => a.completedAt !== null && a.completedAt >= thisMonthStart
  ).length;

  const monthlyTrend = buildMonthlyTrend(completedAssessments);

  // 3 most recent completed assessments with customer name
  const recentAssessments = db
    .select({
      id: assessments.id,
      overallScore: assessments.overallScore,
      templateId: assessments.templateId,
      completedAt: assessments.completedAt,
      customerName: customers.name,
    })
    .from(assessments)
    .innerJoin(customers, eq(assessments.customerId, customers.id))
    .where(isNotNull(assessments.completedAt))
    .orderBy(desc(assessments.completedAt))
    .limit(3)
    .all();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0f172a]">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Here&apos;s a snapshot of your assessments activity.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardContent className="py-6">
            <p className="text-3xl font-bold text-[#1e40af]">{customerCount}</p>
            <p className="text-sm text-[#94a3b8] mt-1">Total Customers</p>
          </CardContent>
        </Card>
        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardContent className="py-6">
            <p className="text-3xl font-bold text-[#1e40af]">{assessmentsThisMonth}</p>
            <p className="text-sm text-[#94a3b8] mt-1">Assessments This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Score trend */}
      <Card className="border border-neutral-200 shadow-sm rounded-lg mb-8">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[#334155]">Average Score Trend</p>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Most recent assessment per customer, averaged monthly
              </p>
            </div>
          </div>
          <ScoreTrendline data={monthlyTrend} />
          <div className="flex items-center gap-4 mt-3 text-xs text-[#94a3b8]">
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 border-t-2 border-dashed border-[#10b981] opacity-60" />
              Excellent (75+)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 border-t-2 border-dashed border-[#f59e0b] opacity-60" />
              Needs Attention (50+)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recent assessments */}
      <div>
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-3">
          Recent Assessments
        </h2>
        {recentAssessments.length === 0 ? (
          <Card className="border border-neutral-200 shadow-sm rounded-lg">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-[#94a3b8]">No assessments completed yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
            {recentAssessments.map((a) => (
              <Link
                key={a.id}
                href={`/assessments/${a.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[#0f172a]">{a.customerName}</p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    {templateLabel(a.templateId)} · {formatDate(a.completedAt)}
                  </p>
                </div>
                <ScoreBadge score={a.overallScore} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
