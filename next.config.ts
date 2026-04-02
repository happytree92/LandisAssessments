import type { NextConfig } from "next";

// Content-Security-Policy for every response.
// Notes:
//   - script-src requires 'unsafe-inline' + 'unsafe-eval' because Next.js 15 App Router
//     emits inline hydration scripts that cannot be nonce-controlled without a custom
//     middleware nonce injection setup. These are still better than no CSP at all.
//   - frame-ancestors 'none' prevents clickjacking — more reliable than X-Frame-Options.
//   - form-action 'self' prevents form POST hijacking to external URLs.
//   - img-src includes data: for the org logo stored as a base64 data URI.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent Turbopack from bundling native Node.js modules or packages that
  // use Node-only APIs. These are loaded at runtime in the server process.
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",   value: CSP },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
