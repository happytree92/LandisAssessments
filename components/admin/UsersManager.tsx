"use client";

import { useState } from "react";
import { AddUserForm } from "./AddUserForm";
import { EditUserModal } from "./EditUserModal";

interface UserRow {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: number | null;
  createdAt: number | null;
  createdAtFormatted: string;
}

interface Props {
  users: UserRow[];
  currentUserId: number;
}

export function UsersManager({ users, currentUserId }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  return (
    <div className="space-y-6">
      {/* Add user */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
            {showAddForm ? "New User" : "Staff Accounts"}
          </h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {showAddForm ? "Cancel" : "+ Add User"}
          </button>
        </div>
        {showAddForm && (
          <div className="px-6 py-5">
            <AddUserForm onClose={() => setShowAddForm(false)} />
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Username</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Created</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive === 0 ? "opacity-40" : ""}>
                <td className="px-6 py-3 font-medium text-[#0f172a]">{u.displayName}</td>
                <td className="px-6 py-3 text-[#334155] font-mono text-xs">{u.username}</td>
                <td className="px-6 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    u.role === "admin"
                      ? "bg-[#dbeafe] text-[#1e40af]"
                      : "bg-neutral-100 text-[#334155]"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-3 text-[#94a3b8]">{u.createdAtFormatted}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs font-medium ${u.isActive === 0 ? "text-[#ef4444]" : "text-[#10b981]"}`}>
                    {u.isActive === 0 ? "Inactive" : "Active"}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => setEditingUser(u)}
                    className="text-sm text-[#1e40af] hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          currentUserId={currentUserId}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
