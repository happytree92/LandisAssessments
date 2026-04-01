import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, assessments, users } from "@/lib/db/schema";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/customers/[id] — get customer with assessment history
export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const customer = db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .get();

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch assessment history with conductor display name
    const history = db
      .select({
        id: assessments.id,
        templateId: assessments.templateId,
        overallScore: assessments.overallScore,
        categoryScores: assessments.categoryScores,
        completedAt: assessments.completedAt,
        createdAt: assessments.createdAt,
        conductorName: users.displayName,
      })
      .from(assessments)
      .leftJoin(users, eq(assessments.conductedBy, users.id))
      .where(eq(assessments.customerId, customerId))
      .orderBy(assessments.createdAt)
      .all();

    return NextResponse.json({ customer, assessments: history });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

// PATCH /api/customers/[id] — update customer
export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const existing = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, contactName, contactEmail, notes } = body as {
      name: unknown;
      contactName: unknown;
      contactEmail: unknown;
      notes: unknown;
    };

    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const updated = db
      .update(customers)
      .set({
        name: name.trim(),
        contactName: typeof contactName === "string" ? contactName.trim() || null : null,
        contactEmail: typeof contactEmail === "string" ? contactEmail.trim() || null : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(customers.id, customerId))
      .returning()
      .get();

    return NextResponse.json({ customer: updated });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

// DELETE /api/customers/[id] — delete customer (cascade assessments)
export async function DELETE(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const existing = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Delete assessments first (foreign key constraint)
    db.delete(assessments).where(eq(assessments.customerId, customerId)).run();
    db.delete(customers).where(eq(customers.id, customerId)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
