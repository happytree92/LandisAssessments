"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    section: "Admin",
    items: [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/questions", label: "Questions" },
      { href: "/admin/branding", label: "Branding" },
      { href: "/admin/export", label: "Export" },
      { href: "/admin/logs", label: "Logs" },
    ],
  },
  {
    section: "Security",
    items: [
      { href: "/admin/sso", label: "SSO Settings" },
      { href: "/admin/ip-allowlist", label: "IP Allowlist" },
      { href: "/admin/users", label: "Users" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-neutral-200 bg-white">
      {NAV_SECTIONS.map((section) => (
        <div key={section.section}>
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
              {section.section}
            </p>
          </div>
          <nav className="py-1">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#f0f7ff] text-[#1e40af] border-r-2 border-[#1e40af]"
                      : "text-[#334155] hover:bg-neutral-50 hover:text-[#1e40af]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
