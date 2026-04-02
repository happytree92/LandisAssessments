import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const rows = db.select().from(settings).all();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const orgName = map["org_name"]?.trim() || "Assessments";
    return {
      title: orgName,
      description: "Internal MSP staff tool for IT security and onboarding assessments",
    };
  } catch {
    return {
      title: "Assessments",
      description: "Internal MSP staff tool for IT security and onboarding assessments",
    };
  }
}

const COLOR_DEFAULTS: Record<string, string> = {
  color_primary: "#1e40af",
  color_accent: "#0ea5e9",
  color_success: "#10b981",
  color_warning: "#f59e0b",
  color_danger: "#ef4444",
};

function buildCssVars(rows: { key: string; value: string }[]): string {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.entries(COLOR_DEFAULTS)
    .map(([key, def]) => `--${key}: ${map[key] ?? def};`)
    .join(" ");
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let cssVars = "";
  try {
    const rows = db.select().from(settings).all();
    cssVars = buildCssVars(rows);
  } catch {
    // DB not ready yet — use defaults (will resolve on next request)
  }

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {cssVars && <style>{`:root { ${cssVars} }`}</style>}
      <body className="min-h-full bg-[#f8fafc] text-[#334155]">
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
