export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { customers, assessments } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export default async function CustomersPage() {
  // Fetch all customers with their latest assessment score
  const rows = db.select().from(customers).orderBy(desc(customers.createdAt)).all();

  // For each customer, grab their latest assessment
  const customerIds = rows.map((c) => c.id);
  const latestAssessments: Record<number, { overallScore: number; createdAt: number | null }> = {};
  if (customerIds.length > 0) {
    for (const cid of customerIds) {
      const latest = db
        .select({ overallScore: assessments.overallScore, createdAt: assessments.createdAt })
        .from(assessments)
        .where(eq(assessments.customerId, cid))
        .orderBy(desc(assessments.createdAt))
        .limit(1)
        .get();
      if (latest) latestAssessments[cid] = latest;
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Customers</h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            {rows.length} {rows.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        <Link href="/customers/new">
          <Button className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
            + Add Customer
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardContent className="py-16 text-center">
            <p className="text-[#94a3b8] text-sm">No customers yet.</p>
            <Link href="/customers/new">
              <Button className="mt-4 bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
                Add your first customer
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((customer) => {
            const latest = latestAssessments[customer.id];
            return (
              <Card
                key={customer.id}
                className="border border-neutral-200 shadow-sm rounded-lg hover:shadow-md transition-shadow"
              >
                <CardContent className="py-4 px-6">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: customer info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-[#0f172a] truncate">
                          {customer.name}
                        </h2>
                        {latest && <ScoreBadge score={latest.overallScore} />}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-[#94a3b8]">
                        {customer.contactName && <span>{customer.contactName}</span>}
                        {customer.contactEmail && <span>{customer.contactEmail}</span>}
                        {latest && (
                          <span>Last assessed {formatDate(latest.createdAt)}</span>
                        )}
                        {!latest && <span>No assessments yet</span>}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/assessments/new?customerId=${customer.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[#1e40af] border-[#1e40af] hover:bg-[#f0f7ff]"
                        >
                          New Assessment
                        </Button>
                      </Link>
                      <Link href={`/customers/${customer.id}`}>
                        <Button size="sm" className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Back to dashboard */}
      <div className="mt-8">
        <Link href="/dashboard" className="text-sm text-[#94a3b8] hover:text-[#334155]">
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}
