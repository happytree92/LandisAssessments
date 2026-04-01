import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent Turbopack from bundling native Node.js modules.
  // better-sqlite3 uses a .node binary that must be loaded at runtime,
  // not analyzed/bundled at build time.
  // Prevent Turbopack from bundling native Node.js modules or packages that
  // use Node-only APIs. These are loaded at runtime in the server process.
  serverExternalPackages: ["better-sqlite3", "@react-pdf/renderer"],
};

export default nextConfig;
