import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { SsoSettings } from "@/components/admin/SsoSettings";

export const dynamic = "force-dynamic";

export default async function AdminSsoPage() {
  const rows = db.select().from(settings).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const current = {
    enabled: map["sso_enabled"] === "true",
    providerUrl: map["sso_provider_url"] ?? "",
    clientId: map["sso_client_id"] ?? "",
    hasSecret: !!map["sso_client_secret"],   // never send the secret to the client
    autoCreate: map["sso_auto_create_users"] !== "false",
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">SSO / Identity Provider</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Configure OAuth2/OIDC single sign-on. Supports any OIDC-compliant provider
          (Entra ID / Azure AD, Okta, Google Workspace, and others).
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <SsoSettings current={current} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">How it works</h2>
        <ul className="text-sm text-[#334155] space-y-2 list-disc list-inside">
          <li>Users click &ldquo;Sign in with SSO&rdquo; on the login page and are redirected to your identity provider.</li>
          <li>On return, the app matches the SSO identity to an existing account by email. If no match exists and auto-create is on, a new <strong>staff</strong> account is created.</li>
          <li>Local username/password login always works as a fallback — useful for the admin account if SSO goes down.</li>
          <li>MFA enforcement (set per-user in Users → Edit) applies to SSO users too. If a user has MFA enforced but not set up, SSO login is blocked until they configure it.</li>
          <li>SSO-created accounts are assigned the <strong>staff</strong> role by default. Promote them to admin in the Users panel.</li>
        </ul>
      </div>
    </div>
  );
}
