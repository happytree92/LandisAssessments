"use client";

import { useRef, useState } from "react";

interface Props {
  savedName: string;
  savedLogo: string; // base64 data URI or ""
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024;

export function OrgIdentityForm({ savedName, savedLogo }: Props) {
  const [orgName, setOrgName] = useState(savedName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [logoPreview, setLogoPreview] = useState<string>(savedLogo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Org name ──────────────────────────────────────────────────────────────

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: orgName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setNameMsg({ ok: false, text: d.error ?? "Save failed" });
      } else {
        setNameMsg({ ok: true, text: "Organization name saved." });
        setTimeout(() => setNameMsg(null), 3000);
      }
    } catch {
      setNameMsg({ ok: false, text: "Network error — please try again." });
    } finally {
      setNameSaving(false);
    }
  }

  // ── Logo ─────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoError(null);
    setLogoMsg(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLogoError("Invalid file type. Only PNG, JPG, and SVG are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setLogoError("File is too large. Maximum size is 2 MB.");
      e.target.value = "";
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!logoFile) return;
    setLogoSaving(true);
    setLogoMsg(null);
    setLogoError(null);
    try {
      const form = new FormData();
      form.append("logo", logoFile);
      const res = await fetch("/api/admin/logo", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setLogoError(d.error ?? "Upload failed");
      } else {
        setLogoFile(null);
        setLogoMsg("Logo saved. Reload the page to see it in the nav.");
        setTimeout(() => setLogoMsg(null), 4000);
      }
    } catch {
      setLogoError("Network error — please try again.");
    } finally {
      setLogoSaving(false);
    }
  }

  async function removeLogo() {
    setRemoving(true);
    setLogoMsg(null);
    setLogoError(null);
    try {
      const res = await fetch("/api/admin/logo", { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setLogoError(d.error ?? "Remove failed");
      } else {
        setLogoPreview("");
        setLogoFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setLogoMsg("Logo removed.");
        setTimeout(() => setLogoMsg(null), 3000);
      }
    } catch {
      setLogoError("Network error — please try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Org name */}
      <form onSubmit={saveName} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]">Organization Name</label>
          <p className="text-xs text-[#94a3b8]">
            Shown in the nav header and on generated PDF reports. Falls back to &ldquo;Landis Assessments&rdquo; if left blank.
          </p>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Landis Assessments"
            maxLength={80}
            className="w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
          />
        </div>
        {nameMsg && (
          <p className={`text-sm rounded px-3 py-2 border ${nameMsg.ok ? "text-[#10b981] bg-green-50 border-green-200" : "text-[#ef4444] bg-red-50 border-red-200"}`}>
            {nameMsg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={nameSaving}
          className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          {nameSaving ? "Saving…" : "Save Name"}
        </button>
      </form>

      <div className="border-t border-neutral-100" />

      {/* Logo */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[#334155]">Organization Logo</p>
          <p className="text-xs text-[#94a3b8]">PNG, JPG, or SVG · max 2 MB · shown in the nav and on PDF reports.</p>
        </div>

        {/* Current logo preview */}
        {logoPreview && (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoPreview}
              alt="Organization logo"
              className="h-12 max-w-[160px] object-contain rounded border border-neutral-200 bg-neutral-50 p-1"
            />
            <button
              type="button"
              onClick={removeLogo}
              disabled={removing}
              className="text-sm text-[#ef4444] hover:underline disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove logo"}
            </button>
          </div>
        )}

        <form onSubmit={uploadLogo} className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleFileChange}
            className="block text-sm text-[#334155] file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#334155] hover:file:bg-neutral-50"
          />
          {logoError && (
            <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{logoError}</p>
          )}
          {logoMsg && (
            <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">{logoMsg}</p>
          )}
          {logoFile && (
            <button
              type="submit"
              disabled={logoSaving}
              className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              {logoSaving ? "Uploading…" : "Upload Logo"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
