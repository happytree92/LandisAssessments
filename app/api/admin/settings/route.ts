import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isAuthError } from "@/lib/api-auth";

/**
 * Allowed settings keys and their validation functions.
 * Any key not in this map is silently rejected.
 * org_logo is managed exclusively via POST /api/admin/logo (separate file validation).
 */
const SETTINGS_SCHEMA: Record<string, (v: string) => boolean> = {
  org_name:              (v) => v.length <= 200,
  log_retention_days:    (v) => ["30", "90", "365"].includes(v),
  color_primary:         (v) => /^#[0-9a-f]{6}$/i.test(v),
  color_accent:          (v) => /^#[0-9a-f]{6}$/i.test(v),
  color_success:         (v) => /^#[0-9a-f]{6}$/i.test(v),
  color_warning:         (v) => /^#[0-9a-f]{6}$/i.test(v),
  color_danger:          (v) => /^#[0-9a-f]{6}$/i.test(v),
  admin_ip_allowlist:    (v) => /^[\d.,: /]*$/.test(v),
  sso_enabled:           (v) => v === "true" || v === "false",
  sso_provider_url:      (v) => v === "" || /^https:\/\/.+/.test(v),
  sso_client_id:         (v) => v.length <= 500,
  sso_client_secret:     (v) => v.length <= 500,
  sso_auto_create_users: (v) => v === "true" || v === "false",
};

// GET /api/admin/settings — all key/value settings
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

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
  const session = await requireAdmin(req);
  if (isAuthError(session)) return session;

  try {
    const body = await req.json() as Record<string, string>;
    const now = Math.floor(Date.now() / 1000);

    const rejected: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== "string" || typeof value !== "string") continue;

      const validate = SETTINGS_SCHEMA[key];
      if (!validate) {
        rejected.push(key);
        continue;
      }
      if (!validate(value)) {
        return NextResponse.json(
          { error: `Invalid value for setting "${key}"` },
          { status: 400 }
        );
      }

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

    if (rejected.length > 0) {
      console.warn("[admin/settings] Rejected unknown keys:", rejected);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
