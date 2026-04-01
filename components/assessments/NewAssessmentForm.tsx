"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/lib/db/schema";

interface NewAssessmentFormProps {
  customers: Customer[];
  preselectedCustomerId?: number;
}

const TEMPLATES = [
  {
    id: "security",
    label: "Security Assessment",
    description:
      "Evaluates the customer's IT security posture across access control, email security, backup & recovery, endpoint protection, network security, incident response, and compliance. ~25 questions.",
    icon: "🔒",
  },
  {
    id: "onboarding",
    label: "New Customer Onboarding",
    description:
      "Verifies that all Landis IT onboarding steps are complete: M365 setup, documentation, remote support tooling, security baseline, and business continuity planning. ~12 questions.",
    icon: "✅",
  },
] as const;

type TemplateId = (typeof TEMPLATES)[number]["id"];

export function NewAssessmentForm({
  customers,
  preselectedCustomerId,
}: NewAssessmentFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(preselectedCustomerId ? 2 : 1);
  const [customerId, setCustomerId] = useState<number | "">(
    preselectedCustomerId ?? ""
  );
  const [templateId, setTemplateId] = useState<TemplateId | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);

  async function handleStart() {
    if (!customerId || !templateId) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to start assessment");
        return;
      }

      router.push(`/assessments/${data.assessment.id}/conduct`);
    } catch {
      setError("Unable to start assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { n: 1, label: "Select Customer" },
          { n: 2, label: "Select Template" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= n
                  ? "bg-[#1e40af] text-white"
                  : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {n}
            </div>
            <span
              className={`text-sm ${
                step >= n ? "text-[#1e40af] font-medium" : "text-[#94a3b8]"
              }`}
            >
              {label}
            </span>
            {n < 2 && <div className="w-8 h-px bg-neutral-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Customer */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="customer">Customer</Label>
            {customers.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">
                No customers found.{" "}
                <a href="/customers/new" className="text-[#1e40af] hover:underline">
                  Add one first.
                </a>
              </p>
            ) : (
              <select
                id="customer"
                value={customerId}
                onChange={(e) =>
                  setCustomerId(e.target.value ? parseInt(e.target.value, 10) : "")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Select a customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.contactName ? ` (${c.contactName})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button
            onClick={() => setStep(2)}
            disabled={!customerId}
            className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
          >
            Next →
          </Button>
        </div>
      )}

      {/* Step 2 — Template */}
      {step === 2 && (
        <div className="space-y-4">
          {selectedCustomer && (
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#94a3b8]">
                Customer:{" "}
                <span className="font-medium text-[#334155]">
                  {selectedCustomer.name}
                </span>
              </span>
              <button
                onClick={() => setStep(1)}
                className="text-[#1e40af] hover:underline text-xs"
              >
                Change
              </button>
            </div>
          )}

          <Label>Assessment Template</Label>

          <div className="grid gap-3">
            {TEMPLATES.map((t) => (
              <Card
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`cursor-pointer border-2 rounded-lg transition-colors ${
                  templateId === t.id
                    ? "border-[#1e40af] bg-[#f0f7ff]"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className="font-semibold text-[#0f172a]">{t.label}</p>
                      <p className="text-sm text-[#94a3b8] mt-0.5">
                        {t.description}
                      </p>
                    </div>
                    {templateId === t.id && (
                      <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-[#1e40af] flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {error && (
            <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleStart}
              disabled={!templateId || loading}
              className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
            >
              {loading ? "Starting…" : "Start Assessment"}
            </Button>
            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
              ← Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
