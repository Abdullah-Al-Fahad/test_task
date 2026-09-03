import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*', // Proxy to Django
      },
      {
        source: '/ws/:path*',
        destination: 'http://backend:8000/ws/:path*', // Proxy WebSockets to Django
      },
    ];
  },
};

export default nextConfig;
