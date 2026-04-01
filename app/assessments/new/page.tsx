import Link from "next/link";
import { db } from "@/lib/db";
import { customers, templates } from "@/lib/db/schema";
import { NewAssessmentForm } from "@/components/assessments/NewAssessmentForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ customerId?: string }> };

export default async function NewAssessmentPage({ searchParams }: Props) {
  const params = await searchParams;
  const preselected = params.customerId ? parseInt(params.customerId, 10) : undefined;

  const allCustomers = db.select().from(customers).all();
  const allTemplates = db.select().from(templates).all();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-[#94a3b8] hover:text-[#334155]">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-[#0f172a] mt-3">New Assessment</h1>
      </div>

      <NewAssessmentForm
        customers={allCustomers}
        templates={allTemplates}
        preselectedCustomerId={
          preselected && !isNaN(preselected) ? preselected : undefined
        }
      />
    </div>
  );
}
