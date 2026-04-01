export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessmentTokens, customers, templates } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { PublicAssessmentForm } from "@/components/assess/PublicAssessmentForm";

type Props = { params: Promise<{ token: string }> };

export default async function PublicAssessPage({ params }: Props) {
  const { token } = await params;
  const now = Math.floor(Date.now() / 1000);

  // Validate token server-side — unified error message, never reveal details
  const record = token
    ? db.select().from(assessmentTokens).where(eq(assessmentTokens.token, token)).get()
    : null;

  const isValid =
    record &&
    record.isActive === 1 &&
    record.expiresAt >= now &&
    !record.usedAt;

  if (!isValid) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-neutral-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#0f172a] mb-2">Link Invalid or Expired</h1>
          <p className="text-sm text-[#94a3b8]">
            This assessment link is no longer valid. Please contact your IT provider to request a new link.
          </p>
        </div>
      </div>
    );
  }

  const customer = db.select().from(customers).where(eq(customers.id, record.customerId)).get();
  const template = db.select().from(templates).where(eq(templates.slug, record.templateId)).get();
  const questions = getQuestionsForTemplate(record.templateId);

  // Only expose first name to the public page
  const customerFirstName = customer?.name?.split(" ")[0] ?? "there";
  const templateName = template?.name ?? record.templateId;

  const publicQuestions = questions.map((q) => ({
    id: q.id,
    category: q.category,
    text: q.text,
    weight: q.weight,
  }));

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Minimal header — no nav, no app chrome */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <span className="text-lg font-bold text-[#1e40af]">Landis IT</span>
          <span className="text-neutral-300">|</span>
          <span className="text-sm text-[#94a3b8]">IT Assessment</span>
        </div>
      </header>

      {/* Welcome banner */}
      <div className="bg-white border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-[#0f172a]">
            Hi {customerFirstName}, welcome to your {templateName}
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            Please answer each question honestly. Your responses help us identify areas to improve your IT security and operations.
          </p>
        </div>
      </div>

      <PublicAssessmentForm
        token={token}
        customerFirstName={customerFirstName}
        templateName={templateName}
        questions={publicQuestions}
      />
    </div>
  );
}
