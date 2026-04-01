export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { isNotNull, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, assessments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function startOfMonthUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-[#10b981] text-white"
      : score >= 50
      ? "bg-[#f59e0b] text-white"
      : "bg-[#ef4444] text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
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

  const avgScore =
    completedAssessments.length === 0
      ? null
      : Math.round(
          completedAssessments.reduce((sum, a) => sum + a.overallScore, 0) /
            completedAssessments.length
        );

  // Recent customers with latest assessment
  const allCustomers = db.select().from(customers).all();
  const recentCustomers = allCustomers.slice(0, 8);

  const customerRows = recentCustomers.map((c) => {
    const latest = completedAssessments
      .filter((a) => a.customerId === c.id)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
    return { ...c, latest };
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
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
        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardContent className="py-6">
            {avgScore !== null ? (
              <>
                <p
                  className={`text-3xl font-bold ${
                    avgScore >= 75
                      ? "text-[#10b981]"
                      : avgScore >= 50
                      ? "text-[#f59e0b]"
                      : "text-[#ef4444]"
                  }`}
                >
                  {avgScore}
                </p>
                <p className="text-sm text-[#94a3b8] mt-1">Avg Score (All Time)</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-[#94a3b8]">—</p>
                <p className="text-sm text-[#94a3b8] mt-1">Avg Score (All Time)</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent customers */}
      {customerRows.length > 0 && (
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
          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
            {customerRows.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[#0f172a]">{c.name}</p>
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
          {allCustomers.length > 8 && (
            <p className="text-xs text-[#94a3b8] mt-2 text-center">
              Showing 8 of {allCustomers.length} customers.{" "}
              <Link href="/customers" className="text-[#1e40af] hover:underline">
                View all →
              </Link>
            </p>
          )}
        </div>
      )}

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
