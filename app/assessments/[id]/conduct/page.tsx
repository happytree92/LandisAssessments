import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessments, customers } from "@/lib/db/schema";
import { securityQuestions, onboardingQuestions } from "@/lib/questions";
import { AssessmentConductForm } from "@/components/assessments/AssessmentConductForm";

type Props = { params: Promise<{ id: string }> };

export default async function ConductPage({ params }: Props) {
  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) notFound();

  const assessment = db
    .select()
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .get();
  if (!assessment) notFound();

  // Already completed — send to results
  if (assessment.completedAt !== null) {
    redirect(`/assessments/${assessmentId}`);
  }

  const customer = db
    .select()
    .from(customers)
    .where(eq(customers.id, assessment.customerId))
    .get();

  const questions =
    assessment.templateId === "security" ? securityQuestions : onboardingQuestions;

  const templateLabel =
    assessment.templateId === "security"
      ? "Security Assessment"
      : "New Customer Onboarding";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/customers/${assessment.customerId}`}
          className="text-sm text-[#94a3b8] hover:text-[#334155]"
        >
          ← {customer?.name ?? "Customer"}
        </Link>
        <h1 className="text-2xl font-bold text-[#0f172a] mt-3">
          {templateLabel}
        </h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Answer every question, then click Save &amp; Complete.
        </p>
      </div>

      <AssessmentConductForm
        assessmentId={assessmentId}
        questions={questions}
        customerName={customer?.name ?? ""}
        templateLabel={templateLabel}
      />
    </div>
  );
}
