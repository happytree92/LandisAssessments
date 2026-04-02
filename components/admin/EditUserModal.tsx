"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: number | null;
  ssoProvider: string | null;
}

interface Props {
  user: UserRow;
  currentUserId: number;
  onClose: () => void;
}

export function EditUserModal({ user, currentUserId, onClose }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(user.role);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentUserId;

  async function patch(updates: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return false;
      }
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, unknown> = { displayName, role };
    // Never send a password field for SSO accounts
    if (newPassword && !user.ssoProvider) updates.password = newPassword;
    const ok = await patch(updates);
    if (ok) {
      router.refresh();
      onClose();
    }
  }

  async function handleToggleActive() {
    const next = user.isActive === 0 ? 1 : 0;
    const ok = await patch({ isActive: next });
    if (ok) {
      router.refresh();
      onClose();
    }
  }

  const inputCls = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e40af]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-lg mx-4">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0f172a]">Edit {user.username}</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#334155] text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#334155]">Display Name</label>
            <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#334155]">Role</label>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {user.ssoProvider ? (
            <div className="rounded-md bg-purple-50 border border-purple-200 px-4 py-3 text-xs text-purple-800 space-y-1">
              <p className="font-semibold">SSO account — no local password</p>
              <p>
                This user authenticates exclusively via SSO. Password change and reset are not
                available. To revoke access, deactivate the account or remove the user from your
                identity provider.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#334155]">
                New Password <span className="text-[#94a3b8] font-normal">(leave blank to keep current)</span>
              </label>
              <input className={inputCls} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min. 8 characters" />
            </div>
          )}

          {error && (
            <p className="text-sm text-[#ef4444] bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors">
                {loading ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
            </div>

            {!isSelf && (
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={loading}
                className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                  user.isActive === 0
                    ? "text-[#10b981] hover:bg-green-50"
                    : "text-[#ef4444] hover:bg-red-50"
                }`}
              >
                {user.isActive === 0 ? "Reactivate" : "Deactivate"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
