import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Answer } from "@/lib/scoring";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfQuestion {
  id: string;
  category: string;
  text: string;
  weight: number;
}

export interface AssessmentReportProps {
  customerName: string;
  conductorName: string;
  templateName: string;
  completedAt: number; // unix timestamp
  overallScore: number;
  categoryScores: Record<string, number>;
  summary: string;
  questions: PdfQuestion[];
  answersMap: Record<string, { answer: Answer; notes?: string }>;
  orgName: string;
  orgLogo: string | null; // base64 data URI or null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 50) return "Needs Attention";
  return "At Risk";
}

function answerColor(answer: Answer): string {
  if (answer === "Yes") return "#10b981";
  if (answer === "No") return "#ef4444";
  return "#f59e0b";
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PRIMARY = "#1e40af";
const NEUTRAL_50 = "#f8fafc";
const NEUTRAL_100 = "#f1f5f9";
const NEUTRAL_400 = "#94a3b8";
const NEUTRAL_700 = "#334155";
const NEUTRAL_900 = "#0f172a";

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56, // leave room for footer
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NEUTRAL_700,
    backgroundColor: "#ffffff",
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  orgLogo: { width: 32, height: 32, objectFit: "contain" },
  wordmark: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PRIMARY, letterSpacing: 0.5 },
  wordmarkSub: { fontSize: 8, color: NEUTRAL_400, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 8, color: NEUTRAL_400 },
  headerCustomer: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NEUTRAL_900, marginTop: 3 },
  headerConductor: { fontSize: 8, color: NEUTRAL_400, marginTop: 2 },

  divider: { borderBottomWidth: 1.5, borderBottomColor: PRIMARY, marginVertical: 10 },

  templateTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NEUTRAL_900, marginBottom: 16 },

  // Score section
  scoreSection: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 16 },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNumber: { fontSize: 26, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  scoreRight: { flex: 1 },
  scoreLabel: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NEUTRAL_900 },
  scoreDesc: { fontSize: 9, color: NEUTRAL_400, marginTop: 3 },

  // Category breakdown
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NEUTRAL_400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  categoryRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  categoryLabel: { fontSize: 8.5, color: NEUTRAL_700, width: 130 },
  barTrack: { flex: 1, height: 7, backgroundColor: NEUTRAL_100, borderRadius: 4, marginHorizontal: 8 },
  barFill: { height: 7, borderRadius: 4 },
  categoryScore: { fontSize: 8.5, fontFamily: "Helvetica-Bold", width: 28, textAlign: "right" },

  // Summary
  summaryBox: {
    backgroundColor: NEUTRAL_50,
    borderRadius: 4,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  summaryTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  summaryText: { fontSize: 9, color: NEUTRAL_700, lineHeight: 1.5 },

  // Question list
  categoryHeader: {
    backgroundColor: NEUTRAL_100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
    marginBottom: 4,
  },
  categoryHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NEUTRAL_400,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  questionRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: NEUTRAL_100,
    alignItems: "flex-start",
  },
  answerBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
    marginTop: 0.5,
  },
  answerBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  questionText: { flex: 1, fontSize: 9, color: NEUTRAL_700, lineHeight: 1.4 },
  questionNotes: { fontSize: 8, color: NEUTRAL_400, fontFamily: "Helvetica-Oblique", marginTop: 2 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7.5,
    color: NEUTRAL_400,
    borderTopWidth: 0.5,
    borderTopColor: NEUTRAL_100,
    paddingTop: 6,
  },

  section: { marginBottom: 16 },
});

// ─── Component ───────────────────────────────────────────────────────────────

export function AssessmentReport({
  customerName,
  conductorName,
  templateName,
  completedAt,
  overallScore,
  categoryScores,
  summary,
  questions,
  answersMap,
  orgName,
  orgLogo,
}: AssessmentReportProps) {
  // Group questions by category
  const byCategory = new Map<string, PdfQuestion[]>();
  for (const q of questions) {
    if (!byCategory.has(q.category)) byCategory.set(q.category, []);
    byCategory.get(q.category)!.push(q);
  }

  const color = scoreColor(overallScore);

  return (
    <Document title={`Assessment — ${customerName}`} author={orgName}>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {orgLogo && !orgLogo.startsWith("data:image/svg") && (
              <Image src={orgLogo} style={s.orgLogo} />
            )}
            <View>
              <Text style={s.wordmark}>{orgName.toUpperCase()}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>{formatDate(completedAt)}</Text>
            <Text style={s.headerCustomer}>{customerName}</Text>
            <Text style={s.headerConductor}>Conducted by {conductorName}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <Text style={s.templateTitle}>{templateName}</Text>

        {/* ── Overall Score ── */}
        <View style={s.scoreSection}>
          <View style={[s.scoreCircle, { backgroundColor: color }]}>
            <Text style={s.scoreNumber}>{overallScore}</Text>
          </View>
          <View style={s.scoreRight}>
            <Text style={[s.scoreLabel, { color }]}>{scoreLabel(overallScore)}</Text>
            <Text style={s.scoreDesc}>Overall compliance score (0–100)</Text>
          </View>
        </View>

        {/* ── Category Breakdown ── */}
        {Object.keys(categoryScores).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Score by Category</Text>
            {Object.entries(categoryScores).map(([cat, score]) => (
              <View key={cat} style={s.categoryRow}>
                <Text style={s.categoryLabel}>{cat}</Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.barFill,
                      { width: `${score}%`, backgroundColor: scoreColor(score) },
                    ]}
                  />
                </View>
                <Text style={[s.categoryScore, { color: scoreColor(score) }]}>
                  {score}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Consultative Summary ── */}
        <View style={s.summaryBox}>
          <Text style={s.summaryTitle}>{orgName ? `${orgName} Recommendation` : "Recommendation"}</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>

        {/* ── Full Question List ── */}
        <View>
          <Text style={s.sectionTitle}>All Answers</Text>
          {Array.from(byCategory.entries()).map(([category, qs]) => (
            <View key={category}>
              <View style={s.categoryHeader}>
                <Text style={s.categoryHeaderText}>{category}</Text>
              </View>
              {qs.map((q) => {
                const a = answersMap[q.id];
                if (!a) return null;
                const displayAnswer =
                  a.answer === "Maybe" ? "Maybe" : a.answer;
                return (
                  <View key={q.id} style={s.questionRow} wrap={false}>
                    <View
                      style={[
                        s.answerBadge,
                        { backgroundColor: answerColor(a.answer) },
                      ]}
                    >
                      <Text style={s.answerBadgeText}>{displayAnswer}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.questionText}>{q.text}</Text>
                      {a.notes ? (
                        <Text style={s.questionNotes}>{a.notes}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Footer (fixed on every page) ── */}
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `Prepared by ${orgName}  ·  Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
