import { NextResponse } from "next/server";
import { calculateScore } from "@/lib/scoring";
import { securityQuestions, onboardingQuestions } from "@/lib/questions";

// ── Hand-calculated expected values ──────────────────────────────────────────
//
// Test A — "Perfect score": all Yes → should be 100
// Test B — "All No": all No → should be 0
// Test C — "Mixed": first two questions only
//   ac-01: weight=10, Yes → 10*100 = 1000 weighted, 10*100 = 1000 max
//   ac-02: weight=10, No  → 10*0   = 0 weighted,    10*100 = 1000 max
//   overall = round((1000/2000)*100) = 50
//
// Test D — "Maybe on high-risk": ac-01 Maybe (weight 10, HIGH_RISK scores)
//   10 * 30 = 300 weighted, 10 * 100 = 1000 max
//   overall = round((300/1000)*100) = 30
//
// Test E — "Onboarding all Yes" → should be 100

export async function GET(): Promise<NextResponse> {
  const allYesSecurity = securityQuestions.map((q) => ({
    questionId: q.id,
    answer: "Yes" as const,
  }));

  const allNoSecurity = securityQuestions.map((q) => ({
    questionId: q.id,
    answer: "No" as const,
  }));

  const testC = [
    { questionId: "ac-01", answer: "Yes" as const },
    { questionId: "ac-02", answer: "No" as const },
  ];

  const testD = [{ questionId: "ac-01", answer: "Maybe" as const }];

  const allYesOnboarding = onboardingQuestions.map((q) => ({
    questionId: q.id,
    answer: "Yes" as const,
  }));

  const results = {
    meta: {
      securityQuestionCount: securityQuestions.length,
      onboardingQuestionCount: onboardingQuestions.length,
      securityCategories: [...new Set(securityQuestions.map((q) => q.category))],
      onboardingCategories: [
        ...new Set(onboardingQuestions.map((q) => q.category)),
      ],
    },
    tests: {
      A_allYesSecurity: {
        description: "All 'Yes' on security — expected overall: 100",
        expected: 100,
        ...calculateScore(allYesSecurity, securityQuestions),
      },
      B_allNoSecurity: {
        description: "All 'No' on security — expected overall: 0",
        expected: 0,
        ...calculateScore(allNoSecurity, securityQuestions),
      },
      C_mixedTwoQuestions: {
        description:
          "ac-01=Yes (w10), ac-02=No (w10) — expected overall: 50",
        expected: 50,
        ...calculateScore(testC, securityQuestions),
      },
      D_maybeHighRisk: {
        description:
          "ac-01=Maybe (w10, HIGH_RISK scores={Yes:100,No:0,Maybe:30}) — expected overall: 30",
        expected: 30,
        ...calculateScore(testD, securityQuestions),
      },
      E_allYesOnboarding: {
        description: "All 'Yes' on onboarding — expected overall: 100",
        expected: 100,
        ...calculateScore(allYesOnboarding, onboardingQuestions),
      },
    },
  };

  // Surface any test failures
  const failures = Object.entries(results.tests)
    .filter(([, v]) => v.overall !== v.expected)
    .map(([name, v]) => `${name}: got ${v.overall}, expected ${v.expected}`);

  return NextResponse.json({
    passed: failures.length === 0,
    failures,
    ...results,
  });
}
