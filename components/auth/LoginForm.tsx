"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Step = "credentials" | "mfa";

// Map URL ?error= values to human-readable messages shown on the login page
const SSO_ERRORS: Record<string, string> = {
  sso_failed: "SSO authentication failed. Please try again or use your password.",
  sso_disabled: "SSO is not enabled on this system.",
  sso_misconfigured: "SSO is not configured correctly. Contact your administrator.",
  sso_cancelled: "SSO sign-in was cancelled.",
  sso_state_expired: "SSO session expired. Please try again.",
  sso_state_mismatch: "SSO security check failed. Please try again.",
  sso_no_email: "Your identity provider did not return an email address.",
  sso_no_account: "No account exists for your SSO identity. Contact your administrator.",
  sso_no_sub: "Your identity provider did not return a valid user identifier.",
  mfa_required: "Multi-factor authentication is required for your account but has not been set up. Contact your administrator.",
  account_inactive: "Your account has been deactivated. Contact your administrator.",
};

interface Props {
  ssoEnabled: boolean;
  orgName?: string;
  initialStep?: Step;
  initialError?: string;
}

export function LoginForm({ ssoEnabled, orgName = "Assessments", initialStep = "credentials", initialError }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.mfaRequired) {
          setStep("mfa");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        setError(data.error ?? "Invalid username or password");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        if (res.status === 401 && data.error?.includes("expired")) {
          setStep("credentials");
          setMfaCode("");
        }
        setError(data.error ?? "Invalid code");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-sm px-4">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">
            {orgName}
          </h1>
          <p className="mt-1 text-sm text-[#94a3b8]">Internal staff portal</p>
        </div>

        <Card className="border border-neutral-200 shadow-sm rounded-lg">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-[#1e293b]">
              {step === "credentials" ? "Sign In" : "Two-Factor Authentication"}
            </h2>
            {step === "mfa" && (
              <p className="text-sm text-[#94a3b8] mt-1">
                Enter the 6-digit code from your authenticator app.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {step === "credentials" ? (
              <div className="space-y-4">
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="admin"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
                    disabled={loading}
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                </form>

                {ssoEnabled && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-neutral-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-2 text-[#94a3b8]">or</span>
                      </div>
                    </div>

                    <a
                      href="/api/auth/sso/start"
                      className="flex items-center justify-center gap-2 w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] shadow-sm hover:bg-neutral-50 transition-colors"
                    >
                      {/* Generic SSO icon */}
                      <svg className="h-4 w-4 text-[#1e40af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Sign in with SSO
                    </a>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleMfa} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-code">Authenticator Code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    disabled={loading}
                    autoFocus
                    className="text-center text-lg tracking-widest"
                  />
                </div>

                {error && (
                  <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
                  disabled={loading || mfaCode.length !== 6}
                >
                  {loading ? "Verifying…" : "Verify Code"}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setMfaCode(""); }}
                  className="w-full text-sm text-[#94a3b8] hover:text-[#334155] transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export the error map so the server page can resolve ?error= params
export { SSO_ERRORS };
