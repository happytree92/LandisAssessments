import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { CustomerForm } from "@/components/customers/CustomerForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) notFound();

  const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm text-[#94a3b8] hover:text-[#334155]"
        >
          ← {customer.name}
        </Link>
        <h1 className="text-2xl font-bold text-[#0f172a] mt-3">Edit Customer</h1>
      </div>

      <CustomerForm customer={customer} />
    </div>
  );
}
