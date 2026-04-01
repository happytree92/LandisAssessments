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

function startOfMonthUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
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
