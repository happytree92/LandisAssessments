"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Customer } from "@/lib/db/schema";

interface CustomerFormProps {
  /** Existing customer — when provided the form is in edit mode */
  customer?: Customer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const isEdit = Boolean(customer);

  const [name, setName] = useState(customer?.name ?? "");
  const [contactName, setContactName] = useState(customer?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(customer?.contactEmail ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit
        ? `/api/customers/${customer!.id}`
        : "/api/customers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactName, contactEmail, notes }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      // Redirect to the customer detail page
      router.push(`/customers/${data.customer.id}`);
      router.refresh();
    } catch {
      setError("Unable to save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border border-neutral-200 shadow-sm rounded-lg max-w-xl">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Company Name <span className="text-[#ef4444]">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              placeholder="Acme Corp"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactName">Contact Name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={loading}
              placeholder="Jane Smith"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={loading}
              placeholder="jane@acme.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="Any relevant notes about this customer..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
              disabled={loading}
            >
              {loading
                ? isEdit ? "Saving…" : "Creating…"
                : isEdit ? "Save Changes" : "Create Customer"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
