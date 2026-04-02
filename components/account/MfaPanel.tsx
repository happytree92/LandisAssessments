"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MfaPanelProps {
  mfaEnabled: boolean;
}

type SetupState = "idle" | "scanning" | "enabling" | "disabling";

export function MfaPanel({ mfaEnabled: initialEnabled }: MfaPanelProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupState, setSetupState] = useState<SetupState>("idle");
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start MFA setup");
      setQrDataUri(data.qrDataUri);
      setSecret(data.secret);
      setSetupState("scanning");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setLoading(false);
    }
  }

  async function enableMfa() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setEnabled(true);
      setSetupState("idle");
      setQrDataUri(null);
      setSecret(null);
      setVerifyCode("");
      setSuccess("MFA enabled successfully. It will be required on your next login.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function disableMfa() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disable MFA");
      setEnabled(false);
      setSetupState("idle");
      setDisablePassword("");
      setSuccess("MFA has been disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable MFA");
    } finally {
      setLoading(false);
    }
  }

  function cancelSetup() {
    setSetupState("idle");
    setQrDataUri(null);
    setSecret(null);
    setVerifyCode("");
    setDisablePassword("");
    setError("");
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            enabled
              ? "bg-green-100 text-green-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <span className="text-sm text-[#94a3b8]">
          {enabled
            ? "A 6-digit code is required every time you sign in."
            : "Not currently enforced for this account."}
        </span>
      </div>

      {/* Success / error messages */}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {success}
        </p>
      )}
      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Idle state ── */}
      {setupState === "idle" && !enabled && (
        <Button
          onClick={startSetup}
          disabled={loading}
          className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
        >
          {loading ? "Loading…" : "Set Up Authenticator App"}
        </Button>
      )}

      {setupState === "idle" && enabled && (
        <Button
          variant="outline"
          onClick={() => { setSetupState("disabling"); setError(""); setSuccess(""); }}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          Disable MFA
        </Button>
      )}

      {/* ── QR code scanning step ── */}
      {setupState === "scanning" && qrDataUri && (
        <div className="space-y-4">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-[#334155]">
              1. Scan this QR code with Google Authenticator or Authy
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUri} alt="MFA QR Code" className="w-40 h-40 rounded" />
            {secret && (
              <div>
                <p className="text-xs text-[#94a3b8] mb-1">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <code className="text-xs bg-neutral-100 border border-neutral-200 rounded px-2 py-1 font-mono select-all">
                  {secret}
                </code>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-[#334155]">
              2. Enter the 6-digit code shown in the app to confirm
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-32 text-center tracking-widest text-lg"
                autoFocus
              />
              <Button
                onClick={enableMfa}
                disabled={loading || verifyCode.length !== 6}
                className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
              >
                {loading ? "Verifying…" : "Verify & Enable"}
              </Button>
              <Button variant="outline" onClick={cancelSetup} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disable MFA step ── */}
      {setupState === "disabling" && (
        <div className="space-y-3">
          <p className="text-sm text-[#334155]">
            Enter your current password to confirm disabling MFA.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="disable-password">Current Password</Label>
            <Input
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={disableMfa}
              disabled={loading || !disablePassword}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Disabling…" : "Disable MFA"}
            </Button>
            <Button variant="outline" onClick={cancelSetup} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
