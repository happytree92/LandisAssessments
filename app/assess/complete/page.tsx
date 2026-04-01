// Static thank-you page — no nav, no links, no app chrome
export default function AssessCompletePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      {/* Minimal header */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <span className="text-lg font-bold text-[#1e40af]">Landis IT</span>
        </div>
      </div>

      <div className="max-w-md w-full bg-white rounded-lg border border-neutral-200 shadow-sm p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[#10b981]/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#0f172a] mb-3">Thank You!</h1>
        <p className="text-[#334155] text-sm leading-relaxed">
          Thank you for completing the assessment. Your IT provider will be in touch to review the results and discuss next steps.
        </p>
        <p className="text-[#94a3b8] text-xs mt-4">You may close this window.</p>
      </div>
    </div>
  );
}
