import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { BrandingForm } from "@/components/admin/BrandingForm";
import { BaseUrlForm } from "@/components/admin/BaseUrlForm";
import { OrgIdentityForm } from "@/components/admin/OrgIdentityForm";
import { IpAllowlistForm } from "@/components/admin/IpAllowlistForm";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const rows = db.select().from(settings).all();
  const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const saved = Object.fromEntries(
    rows
      .filter((r) => r.key.startsWith("color_"))
      .map((r) => [r.key, r.value])
  );

  const baseUrl = settingsMap["base_url"] ?? "";
  const orgName = settingsMap["org_name"] ?? "";
  const orgLogo = settingsMap["org_logo"] ?? "";
  const ipAllowlist = settingsMap["admin_ip_allowlist"] ?? "";

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Branding & Settings</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Configure your organization identity, domain, and color palette.
        </p>
      </div>

      {/* Organization identity */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-6">Organization</h2>
        <OrgIdentityForm savedName={orgName} savedLogo={orgLogo} />
      </div>

      {/* General settings */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">General</h2>
        <BaseUrlForm saved={baseUrl} />
      </div>

      {/* Color branding */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">Colors</h2>
        <BrandingForm saved={saved} />
      </div>

      {/* Security */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-4">Security</h2>
        <IpAllowlistForm saved={ipAllowlist} />
      </div>
    </div>
  );
}
