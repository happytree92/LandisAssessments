import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET /api/admin/templates — list all active templates
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db.select().from(templates).all();
    return NextResponse.json({ templates: rows });
  } catch (err) {
    console.error("[admin/templates GET]", err);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST /api/admin/templates — create a new template
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { name?: string; description?: string };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const slug = toSlug(name);
    if (!slug) {
      return NextResponse.json({ error: "Could not derive a valid slug from that name" }, { status: 400 });
    }

    const existing = db.select().from(templates).where(eq(templates.slug, slug)).get();
    if (existing) {
      return NextResponse.json(
        { error: `A template with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const created = db
      .insert(templates)
      .values({
        slug,
        name,
        description: body.description?.trim() || null,
        isActive: 1,
        createdAt: now,
      })
      .returning()
      .get();

    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/templates POST]", err);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
