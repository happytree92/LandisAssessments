import { cookies } from "next/headers";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function TopNav() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  let displayName = "";
  try {
    const payload = await verifyToken(token);
    displayName = payload.displayName;
  } catch {
    return null;
  }

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="text-base font-bold text-[#1e40af] tracking-tight hover:text-[#1e3a8a] transition-colors"
        >
          Landis Assessments
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[#334155] hover:text-[#1e40af] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/customers"
            className="text-sm font-medium text-[#334155] hover:text-[#1e40af] transition-colors"
          >
            Customers
          </Link>
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#94a3b8] hidden sm:block">{displayName}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
