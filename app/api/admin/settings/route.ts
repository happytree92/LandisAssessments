import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/admin/settings — all key/value settings
export async function GET(): Promise<NextResponse> {
  try {
    const rows = db.select().from(settings).all();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json({ settings: map });
  } catch (err) {
    console.error("[admin/settings GET]", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST /api/admin/settings — upsert a map of key/value pairs
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as Record<string, string>;
    const now = Math.floor(Date.now() / 1000);

    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== "string" || typeof value !== "string") continue;
      const existing = db.select().from(settings).where(eq(settings.key, key)).get();
      if (existing) {
        db.update(settings)
          .set({ value, updatedAt: now })
          .where(eq(settings.key, key))
          .run();
      } else {
        db.insert(settings)
          .values({ key, value, updatedAt: now })
          .run();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
