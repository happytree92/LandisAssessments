"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-[#94a3b8] hover:text-[#334155] transition-colors"
    >
      Sign out
    </button>
  );
}
