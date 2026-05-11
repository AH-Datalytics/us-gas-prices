import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/**": ["./us_energy.db"],
  },
  turbopack: {
    root: ".",
  },
};

export default nextConfig;
