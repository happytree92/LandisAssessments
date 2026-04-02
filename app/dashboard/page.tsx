export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, assessments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerList } from "@/components/dashboard/CustomerList";
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

    // All assessments completed in this month
    const inMonth = completedAssessments.filter(
      (a) => a.completedAt !== null && a.completedAt >= monthStart && a.completedAt <= monthEnd
    );

    if (inMonth.length === 0) {
      months.push({ label, score: null });
      continue;
    }

    // For each customer, keep only their most recent assessment within the month
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

  // All customers with their latest assessment
  const allCustomers = db.select().from(customers).all();

  const customerRows = allCustomers.map((c) => {
    const latest = completedAssessments
      .filter((a) => a.customerId === c.id)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
    return {
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      latest: latest ? { overallScore: latest.overallScore, completedAt: latest.completedAt } : null,
    };
  });

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
      <Card className="border border-neutral-200 shadow-sm rounded-lg mb-10">
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

      {/* Customers with search + sort */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
            Customers
          </h2>
          <Link
            href="/customers/new"
            className="text-sm text-[#1e40af] hover:underline font-medium"
          >
            + Add Customer
          </Link>
        </div>
        <CustomerList customers={customerRows} />
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <Link href="/customers">
          <Button className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
            View All Customers
          </Button>
        </Link>
        <Link href="/customers/new">
          <Button variant="outline">Add Customer</Button>
        </Link>
      </div>
    </div>
  );
}
