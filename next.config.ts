import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // SECURITY: do NOT enable `skipProxyUrlNormalize`. The proxy public-path allowlist (src/proxy.ts)
  // assumes Next normalizes the pathname first, so `/api/cron/../knowledge/upload` collapses to a
  // protected path BEFORE the cron allowlist runs. Skipping normalization would reopen a path-traversal
  // bypass of the admin gate (Ronda-1 N3).
};

export default nextConfig;
