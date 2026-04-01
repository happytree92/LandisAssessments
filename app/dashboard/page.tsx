export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const customerCount = db.select().from(customers).all().length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[#0f172a] mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardContent className="py-6">
            <p className="text-3xl font-bold text-[#1e40af]">{customerCount}</p>
            <p className="text-sm text-[#94a3b8] mt-1">Total Customers</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/customers">
          <Button className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
            View Customers
          </Button>
        </Link>
        <Link href="/customers/new">
          <Button variant="outline">Add Customer</Button>
        </Link>
      </div>
    </div>
  );
}
