import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The repo sits inside a home folder that has its own lockfile.
  turbopack: { root: process.cwd() },
  // Rendered on the server with Node APIs; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF fonts are read from disk at runtime.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  experimental: {
    // Guest documents (≤8 MB) and hotel images (≤4 MB) go through server actions.
    serverActions: { bodySizeLimit: "9mb" },
  },
};

export default nextConfig;
