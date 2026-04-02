import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthError } from "@/lib/api-auth";
import { log } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/templates/[id]
// Accepts one of three exclusive actions per request:
//   { isActive: 0|1 }      — toggle visibility (draft ↔ active)
//   { softDelete: true }   — begin 30-day soft-delete window
//   { recover: true }      — restore from soft-delete (within window)
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const { id } = await params;
    const templateId = parseInt(id, 10);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = db.select().from(templates).where(eq(templates.id, templateId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json() as {
      isActive?: number;
      softDelete?: boolean;
      recover?: boolean;
    };

    const now = Math.floor(Date.now() / 1000);
    const updates: Record<string, unknown> = {};

    if (body.softDelete === true) {
      if (existing.deletedAt !== null) {
        return NextResponse.json({ error: "Template is already deleted" }, { status: 409 });
      }
      updates.deletedAt = now;
      log({
        level: "warn",
        category: "system",
        action: "template.soft_deleted",
        userId: session.userId,
        username: session.username,
        resourceType: "template",
        resourceId: templateId,
        metadata: { templateName: existing.name, slug: existing.slug },
      });
    } else if (body.recover === true) {
      if (existing.deletedAt === null) {
        return NextResponse.json({ error: "Template is not deleted" }, { status: 409 });
      }
      const windowEnd = existing.deletedAt + 30 * 86400;
      if (now > windowEnd) {
        return NextResponse.json({ error: "Recovery window has expired" }, { status: 410 });
      }
      updates.deletedAt = null;
      log({
        level: "info",
        category: "system",
        action: "template.recovered",
        userId: session.userId,
        username: session.username,
        resourceType: "template",
        resourceId: templateId,
        metadata: { templateName: existing.name, slug: existing.slug },
      });
    } else if (typeof body.isActive === "number") {
      if (existing.deletedAt !== null) {
        return NextResponse.json(
          { error: "Cannot change visibility of a deleted template" },
          { status: 409 }
        );
      }
      updates.isActive = body.isActive === 1 ? 1 : 0;
      log({
        level: "info",
        category: "system",
        action: body.isActive === 1 ? "template.activated" : "template.set_draft",
        userId: session.userId,
        username: session.username,
        resourceType: "template",
        resourceId: templateId,
        metadata: { templateName: existing.name, slug: existing.slug },
      });
    } else {
      return NextResponse.json({ error: "No valid action specified" }, { status: 400 });
    }

    const updated = db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, templateId))
      .returning()
      .get();

    return NextResponse.json({ template: updated });
  } catch (err) {
    console.error("[admin/templates/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}
