"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  current: {
    enabled: boolean;
    providerUrl: string;
    clientId: string;
    hasSecret: boolean;   // true if a secret is already stored — we never echo it back
    autoCreate: boolean;
  };
}

export function SsoSettings({ current }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(current.enabled);
  const [providerUrl, setProviderUrl] = useState(current.providerUrl);
  const [clientId, setClientId] = useState(current.clientId);
  const [clientSecret, setClientSecret] = useState("");         // only set if changing
  const [autoCreate, setAutoCreate] = useState(current.autoCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const body: Record<string, string> = {
      sso_enabled: enabled ? "true" : "false",
      sso_provider_url: providerUrl.trim(),
      sso_client_id: clientId.trim(),
      sso_auto_create_users: autoCreate ? "true" : "false",
    };

    // Only send the secret if the admin typed a new one
    if (clientSecret.trim()) {
      body["sso_client_secret"] = clientSecret.trim();
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
      setClientSecret(""); // clear after save
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 focus:border-[#1e40af] disabled:bg-neutral-50 disabled:text-neutral-400";

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#0f172a]">Enable SSO</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Show &ldquo;Sign in with SSO&rdquo; on the login page and allow OIDC-based authentication.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1e40af]/30 ${
            enabled ? "bg-[#1e40af]" : "bg-neutral-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Provider URL */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#334155]">
          OIDC Discovery URL
        </label>
        <input
          type="url"
          className={inputCls}
          value={providerUrl}
          onChange={(e) => setProviderUrl(e.target.value)}
          placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
          required={enabled}
          disabled={saving}
        />
        <p className="text-xs text-[#94a3b8]">
          The base URL of your identity provider. The app appends
          {" "}<code className="font-mono bg-neutral-100 px-1 rounded">/.well-known/openid-configuration</code> to discover endpoints.
          Examples: <span className="font-mono">https://accounts.google.com</span>,{" "}
          <span className="font-mono">https://login.microsoftonline.com/&#123;tenant&#125;/v2.0</span>,{" "}
          <span className="font-mono">https://&#123;domain&#125;.okta.com</span>
        </p>
      </div>

      {/* Client ID */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#334155]">Client ID</label>
        <input
          type="text"
          className={inputCls}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="your-client-id"
          required={enabled}
          disabled={saving}
          autoComplete="off"
        />
      </div>

      {/* Client Secret */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#334155]">
          Client Secret
          {current.hasSecret && (
            <span className="ml-2 text-xs font-normal text-[#10b981]">
              (secret is set — leave blank to keep current)
            </span>
          )}
        </label>
        <input
          type="password"
          className={inputCls}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={current.hasSecret ? "••••••••••••••••" : "your-client-secret"}
          required={enabled && !current.hasSecret}
          disabled={saving}
          autoComplete="new-password"
        />
      </div>

      {/* Auto-create users */}
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <input
          type="checkbox"
          id="auto-create"
          checked={autoCreate}
          onChange={(e) => setAutoCreate(e.target.checked)}
          disabled={saving}
          className="h-4 w-4 rounded border-neutral-300 text-[#1e40af] focus:ring-[#1e40af]/30"
        />
        <div>
          <label htmlFor="auto-create" className="text-sm font-medium text-[#0f172a] cursor-pointer">
            Auto-create accounts for new SSO users
          </label>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            If unchecked, only users with an existing account (matched by email) can sign in via SSO.
          </p>
        </div>
      </div>

      {/* Redirect URI hint */}
      <div className="rounded-md bg-[#f0f7ff] border border-[#bfdbfe] px-4 py-3 text-xs text-[#1e40af] space-y-1">
        <p className="font-semibold">Register this Redirect URI with your identity provider:</p>
        <p className="font-mono break-all">
          {typeof window !== "undefined"
            ? `${window.location.origin}/api/auth/sso/callback`
            : "<your-app-url>/api/auth/sso/callback"}
        </p>
        <p className="text-[#334155] mt-1">
          In your provider&rsquo;s app registration, set the redirect/callback URL to the value above.
          Enable &ldquo;Authorization Code&rdquo; flow with PKCE.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">
          SSO settings saved.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-5 py-2 text-sm font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save SSO Settings"}
      </button>
    </form>
  );
}
