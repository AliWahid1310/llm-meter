import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/api-health',
        destination: 'http://localhost:3000/health',
      },
    ];
  },
};

export default nextConfig;
