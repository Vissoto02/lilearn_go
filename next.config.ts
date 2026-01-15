import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed cacheComponents as it conflicts with dynamic data fetching
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
