"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Template {
  id: number;
  slug: string;
  name: string;
}

interface TokenRecord {
  id: number;
  templateId: string;
  expiresAt: number;
  usedAt: number | null;
  isActive: number | null;
  createdAt: number | null;
  status: string;
}

interface Props {
  customerId: number;
  templates: Template[];
  initialTokens: TokenRecord[];
}

const EXPIRY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
];

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-blue-50 text-blue-700",
    completed: "bg-[#10b981]/10 text-[#10b981]",
    expired: "bg-neutral-100 text-neutral-500",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.expired}`}>
      {status}
    </span>
  );
}

export function ShareAssessmentModal({ customerId, templates, initialTokens }: Props) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.slug ?? "");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState<TokenRecord[]>(initialTokens);
  const [revoking, setRevoking] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setShareUrl("");
    setCopied(false);

    try {
      const res = await fetch("/api/assessment-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId, expiresInDays }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to generate link");
        return;
      }

      setShareUrl(data.shareUrl);

      // Refresh token list
      const listRes = await fetch(`/api/assessment-tokens?customerId=${customerId}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        setTokens(listData.tokens ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(tokenId: number) {
    setRevoking(tokenId);
    try {
      const res = await fetch(`/api/assessment-tokens/${tokenId}`, { method: "PATCH" });
      if (res.ok) {
        setTokens((prev) =>
          prev.map((t) => (t.id === tokenId ? { ...t, isActive: 0, status: "expired" } : t))
        );
      }
    } catch {
      // silent — user can retry
    } finally {
      setRevoking(null);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-[#1e40af] text-[#1e40af] hover:bg-[#f0f7ff]"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Share Assessment
      </Button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-[#0f172a]">Share Assessment Link</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[#94a3b8] hover:text-[#334155] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Template picker */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#334155]">Assessment Template</label>
                <select
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Expiry picker */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#334155]">Link Expires In</label>
                <div className="flex gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setExpiresInDays(opt.value)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                        expiresInDays === opt.value
                          ? "border-[#1e40af] bg-[#f0f7ff] text-[#1e40af]"
                          : "border-neutral-200 text-[#334155] hover:border-neutral-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              {/* Generated URL */}
              {shareUrl && (
                <div className="rounded-md border border-[#10b981] bg-green-50 p-3">
                  <p className="text-xs font-medium text-[#10b981] mb-1.5">Shareable Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 text-xs bg-white border border-neutral-200 rounded px-2 py-1.5 text-[#334155] font-mono truncate focus:outline-none"
                    />
                    <button
                      onClick={copyUrl}
                      className={`shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        copied
                          ? "bg-[#10b981] text-white"
                          : "bg-[#1e40af] text-white hover:bg-[#1e3a8a]"
                      }`}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-[#94a3b8] mt-1.5">
                    Send this link to the customer. It expires in {expiresInDays} days and can only be used once.
                  </p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={loading || !templateId}
                className="w-full bg-[#1e40af] hover:bg-[#1e3a8a] text-white"
              >
                {loading ? "Generating…" : "Generate Link"}
              </Button>
            </div>

            {/* Token history */}
            {tokens.length > 0 && (
              <div className="border-t border-neutral-200 px-6 py-5">
                <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">
                  Previously Generated Links
                </h3>
                <div className="space-y-2">
                  {tokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5"
                    >
                      <div className="text-xs text-[#334155] space-y-0.5">
                        <p className="font-medium">{templates.find((tpl) => tpl.slug === t.templateId)?.name ?? t.templateId}</p>
                        <p className="text-[#94a3b8]">
                          Created {formatDate(t.createdAt)} · Expires {formatDate(t.expiresAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={t.status} />
                        {t.status === "pending" && (
                          <button
                            onClick={() => handleRevoke(t.id)}
                            disabled={revoking === t.id}
                            className="text-xs text-[#ef4444] hover:underline disabled:opacity-50"
                          >
                            {revoking === t.id ? "…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
