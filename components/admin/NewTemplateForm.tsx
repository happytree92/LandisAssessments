"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Preview the auto-generated slug
  const slugPreview = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create template");
      } else {
        setSuccess(`Template "${data.template.name}" created. You can now import questions for it via CSV using the slug "${data.template.slug}".`);
        setName("");
        setDescription("");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]" htmlFor="tpl-name">
            Template Name <span className="text-[#ef4444]">*</span>
          </label>
          <input
            id="tpl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Compliance Audit"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
            required
          />
          {slugPreview && (
            <p className="text-xs text-[#94a3b8]">
              Slug: <code className="font-mono">{slugPreview}</code>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#334155]" htmlFor="tpl-desc">
            Description <span className="text-[#94a3b8] font-normal">(optional)</span>
          </label>
          <input
            id="tpl-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description shown on assessment picker"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[#10b981] bg-green-50 border border-green-200 rounded px-3 py-2">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={!name.trim() || loading}
        className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        {loading ? "Creating…" : "Create Template"}
      </button>
    </form>
  );
}
