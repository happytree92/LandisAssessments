export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { customers, assessments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { CustomerList } from "@/components/dashboard/CustomerList";

export default async function CustomersPage() {
  const rows = db.select().from(customers).orderBy(desc(customers.createdAt)).all();

  const customerRows = rows.map((c) => {
    const latest = db
      .select({
        overallScore: assessments.overallScore,
        completedAt: assessments.completedAt,
      })
      .from(assessments)
      .where(eq(assessments.customerId, c.id))
      .orderBy(desc(assessments.completedAt))
      .limit(1)
      .get();

    return {
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      latest: latest ?? null,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
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

      <CustomerList customers={customerRows} />
    </div>
  );
}
