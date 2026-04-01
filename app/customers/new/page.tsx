import Link from "next/link";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/customers" className="text-sm text-[#94a3b8] hover:text-[#334155]">
          ← All Customers
        </Link>
        <h1 className="text-2xl font-bold text-[#0f172a] mt-3">Add Customer</h1>
      </div>

      <CustomerForm />
    </div>
  );
}
