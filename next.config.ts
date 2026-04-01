import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent Turbopack from bundling native Node.js modules.
  // better-sqlite3 uses a .node binary that must be loaded at runtime,
  // not analyzed/bundled at build time.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
