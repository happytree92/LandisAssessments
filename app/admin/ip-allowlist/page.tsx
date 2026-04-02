import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { IpAllowlistForm } from "@/components/admin/IpAllowlistForm";

export const dynamic = "force-dynamic";

export default async function AdminIpAllowlistPage() {
  const rows = db.select().from(settings).all();
  const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const ipAllowlist = settingsMap["admin_ip_allowlist"] ?? "";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">IP Allowlist</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Restrict local username/password logins to specific IP addresses. SSO users are not
          affected — their access is governed by your identity provider.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <IpAllowlistForm saved={ipAllowlist} />
      </div>
    </div>
  );
}
