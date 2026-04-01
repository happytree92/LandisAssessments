"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DeleteCustomerButtonProps {
  customerId: number;
  customerName: string;
}

export function DeleteCustomerButton({ customerId, customerName }: DeleteCustomerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${customerName}"? This will also delete all their assessments. This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/customers");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to delete customer");
      }
    } catch {
      alert("Unable to delete. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDelete}
      disabled={loading}
      className="text-[#ef4444] border-[#ef4444] hover:bg-red-50"
    >
      {loading ? "Deleting…" : "Delete"}
    </Button>
  );
}
