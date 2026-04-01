import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { BrandingForm } from "@/components/admin/BrandingForm";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const rows = db.select().from(settings).all();
  const saved = Object.fromEntries(
    rows
      .filter((r) => r.key.startsWith("color_"))
      .map((r) => [r.key, r.value])
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Branding</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Customize the color palette. Changes apply as CSS variables across the app on next page load.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <BrandingForm saved={saved} />
      </div>
    </div>
  );
}
