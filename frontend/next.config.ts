import type { NextConfig } from "next";

// The browser only talks to Next.js; /api/* is proxied to the FastAPI backend.
const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // Re-running the engines over 500k+ transactions can take longer than the default 30s.
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
