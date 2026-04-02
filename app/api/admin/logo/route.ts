import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "data:image/png;base64,",
  "image/jpeg": "data:image/jpeg;base64,",
  "image/svg+xml": "data:image/svg+xml;base64,",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// POST /api/admin/logo — multipart form-data with a "logo" file field
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const formData = await req.formData();
    const file = formData.get("logo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG, JPG, and SVG are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 2 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `${ALLOWED_TYPES[file.type]}${base64}`;

    const now = Math.floor(Date.now() / 1000);
    const existing = db.select().from(settings).where(eq(settings.key, "org_logo")).get();
    if (existing) {
      db.update(settings)
        .set({ value: dataUri, updatedAt: now })
        .where(eq(settings.key, "org_logo"))
        .run();
    } else {
      db.insert(settings).values({ key: "org_logo", value: dataUri, updatedAt: now }).run();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/logo POST]", err);
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }
}

// DELETE /api/admin/logo — remove the stored logo
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    db.delete(settings).where(eq(settings.key, "org_logo")).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/logo DELETE]", err);
    return NextResponse.json({ error: "Failed to remove logo" }, { status: 500 });
  }
}
