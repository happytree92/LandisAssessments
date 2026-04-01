import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { BulkExportForm } from "@/components/admin/BulkExportForm";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const allCustomers = db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .all();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Bulk PDF Export</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Download all completed assessments for a customer and date range as a ZIP of PDFs.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <BulkExportForm customers={allCustomers} />
      </div>
    </div>
  );
}
