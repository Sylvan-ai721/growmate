import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 950_000 },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
