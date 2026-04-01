import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessmentTokens, customers, templates } from "@/lib/db/schema";
import { getQuestionsForTemplate } from "@/lib/questions-db";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/assess/[token] — PUBLIC: validate token and return customer name + template + questions
// Never returns customer records beyond first name, and never reveals raw token state details.
export async function GET(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { token } = await params;
    const now = Math.floor(Date.now() / 1000);

    const record = db
      .select()
      .from(assessmentTokens)
      .where(eq(assessmentTokens.token, token))
      .get();

    // Unified invalid message — do not reveal whether token exists
    if (!record || record.isActive === 0 || record.expiresAt < now || record.usedAt) {
      return NextResponse.json(
        { error: "This link is invalid or has expired. Contact your IT provider." },
        { status: 410 }
      );
    }

    const customer = db.select().from(customers).where(eq(customers.id, record.customerId)).get();
    const template = db.select().from(templates).where(eq(templates.slug, record.templateId)).get();
    const questions = getQuestionsForTemplate(record.templateId);

    // Public GET returns only: customer first name, template name, question list
    const customerFirstName = customer?.name?.split(" ")[0] ?? "there";

    return NextResponse.json({
      customerFirstName,
      templateName: template?.name ?? record.templateId,
      templateId: record.templateId,
      questions: questions.map((q) => ({
        id: q.id,
        category: q.category,
        text: q.text,
        weight: q.weight,
      })),
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to load assessment" }, { status: 500 });
  }
}
