import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Landis Assessments",
  description: "Internal MSP staff tool for IT security and onboarding assessments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f8fafc] text-[#334155]">
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
