interface ScoreCardProps {
  score: number;
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Needs Attention";
  return "At Risk";
}

function scoreColors(score: number): {
  ring: string;
  bg: string;
  text: string;
  badge: string;
} {
  if (score >= 75) {
    return {
      ring: "ring-[#10b981]",
      bg: "bg-[#f0fdf4]",
      text: "text-[#10b981]",
      badge: "bg-[#10b981] text-white",
    };
  }
  if (score >= 50) {
    return {
      ring: "ring-[#f59e0b]",
      bg: "bg-[#fffbeb]",
      text: "text-[#f59e0b]",
      badge: "bg-[#f59e0b] text-white",
    };
  }
  return {
    ring: "ring-[#ef4444]",
    bg: "bg-[#fef2f2]",
    text: "text-[#ef4444]",
    badge: "bg-[#ef4444] text-white",
  };
}

export function ScoreCard({ score }: ScoreCardProps) {
  const colors = scoreColors(score);
  const label = scoreLabel(score);

  return (
    <div className={`rounded-2xl ${colors.bg} p-8 flex items-center gap-8`}>
      {/* Circle score */}
      <div
        className={`w-32 h-32 rounded-full ring-8 ${colors.ring} flex flex-col items-center justify-center shrink-0`}
      >
        <span className={`text-4xl font-bold ${colors.text}`}>{score}</span>
        <span className="text-xs text-[#94a3b8] mt-0.5">out of 100</span>
      </div>

      {/* Label + description */}
      <div>
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${colors.badge} mb-2`}
        >
          {label}
        </span>
        <p className="text-[#334155] text-sm leading-relaxed max-w-sm">
          {score >= 75
            ? "This customer demonstrates a strong security posture with most controls in place."
            : score >= 50
            ? "This customer has made progress but several important controls still need attention."
            : "Several critical gaps were identified. Immediate action is recommended."}
        </p>
      </div>
    </div>
  );
}
