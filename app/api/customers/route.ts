import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// GET /api/customers — list all customers
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt))
      .all();

    return NextResponse.json({ customers: rows });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// POST /api/customers — create a customer
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
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

    const now = Math.floor(Date.now() / 1000);

    const result = db
      .insert(customers)
      .values({
        name: name.trim(),
        contactName: typeof contactName === "string" ? contactName.trim() || null : null,
        contactEmail: typeof contactEmail === "string" ? contactEmail.trim() || null : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return NextResponse.json({ customer: result }, { status: 201 });
  } catch (err) {
    if (process.env.NODE_ENV === "development") console.error(err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
