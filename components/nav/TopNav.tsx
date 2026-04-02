import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { UserMenu } from "./UserMenu";

export async function TopNav() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  let displayName = "";
  let role = "staff";
  try {
    const payload = await verifyToken(token);
    displayName = payload.displayName;
    role = payload.role;
  } catch {
    return null;
  }

  const rows = db.select().from(settings).all();
  const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const orgName = settingsMap["org_name"]?.trim() || "Assessments";
  const orgLogo = settingsMap["org_logo"] || null;

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo / wordmark */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          {orgLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogo}
              alt={orgName}
              className="h-7 max-w-[120px] object-contain"
            />
          )}
          <span className="text-base font-bold text-[#1e40af] tracking-tight">
            {orgName}
          </span>
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
          {role === "admin" && (
            <Link
              href="/admin"
              className="text-sm font-medium text-[#334155] hover:text-[#1e40af] transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* User dropdown */}
        <UserMenu displayName={displayName} />
      </div>
    </header>
  );
}
