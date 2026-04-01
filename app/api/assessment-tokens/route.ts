import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assessmentTokens, customers, templates } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { log } from "@/lib/logger";

// POST /api/assessment-tokens — staff creates a shareable self-assessment link
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await verifyToken(sessionCookie);

    const body = await req.json();
    const { customerId, templateId, expiresInDays } = body as {
      customerId: unknown;
      templateId: unknown;
      expiresInDays?: unknown;
    };

    if (typeof customerId !== "number" || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "customerId (number) and templateId (string) are required" },
        { status: 400 }
      );
    }

    const days = typeof expiresInDays === "number" && [7, 14, 30, 60].includes(expiresInDays)
      ? expiresInDays
      : 30;

    // Validate customer exists
    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Validate template exists and is active
    const template = db.select().from(templates).where(eq(templates.slug, templateId)).get();
    if (!template || template.isActive === 0) {
      return NextResponse.json({ error: "Template not found or inactive" }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + days * 24 * 60 * 60;
    const token = crypto.randomUUID();

    const record = db
      .insert(assessmentTokens)
      .values({
        token,
        customerId,
        templateId,
        createdBy: session.userId,
        expiresAt,
        isActive: 1,
        createdAt: now,
      })
      .returning()
      .get();

    // Build the shareable URL from the request origin
    const origin = req.nextUrl.origin;
    const shareUrl = `${origin}/assess/${token}`;

    log({
      level: "info",
      category: "token",
      action: "token.generated",
      userId: session.userId,
      username: session.username,
      resourceType: "assessment_token",
      resourceId: record.id,
      // Never log the raw token value
      metadata: { customerId, templateId, expiresAt },
    });

    return NextResponse.json({ token: record, shareUrl }, { status: 201 });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}

// GET /api/assessment-tokens?customerId=X — list tokens for a customer (staff)
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await verifyToken(sessionCookie);

    const customerIdParam = req.nextUrl.searchParams.get("customerId");
    if (!customerIdParam) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const customerId = parseInt(customerIdParam, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    const rows = db
      .select()
      .from(assessmentTokens)
      .where(eq(assessmentTokens.customerId, customerId))
      .all();

    const now = Math.floor(Date.now() / 1000);

    // Compute display status for each token
    const tokens = rows.map((t) => ({
      ...t,
      status: t.usedAt
        ? "completed"
        : t.isActive === 0 || t.expiresAt < now
        ? "expired"
        : "pending",
    }));

    return NextResponse.json({ tokens });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}
