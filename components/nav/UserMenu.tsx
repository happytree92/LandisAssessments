"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface Props {
  displayName: string;
}

export function UserMenu({ displayName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-[#334155] hover:text-[#1e40af] transition-colors"
        >
          <span className="hidden sm:block">{displayName}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-neutral-200 bg-white shadow-lg z-30">
            <button
              onClick={() => { setOpen(false); setShowChangePassword(true); }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#334155] hover:bg-neutral-50 transition-colors"
            >
              Change Password
            </button>
            <hr className="border-neutral-100" />
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-[#ef4444] hover:bg-red-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  );
}
