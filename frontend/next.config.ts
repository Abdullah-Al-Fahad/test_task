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
        source: '/metrics',
        destination: 'http://backend:8000/metrics/',
      },
      {
        source: '/metrics/',
        destination: 'http://backend:8000/metrics/',
      },
      {
        source: '/metrics/:path*',
        destination: 'http://backend:8000/metrics/:path*', // Proxy Prometheus metrics to Django
      },
      {
        source: '/ws/:path*',
        destination: 'http://backend:8000/ws/:path*', // Proxy WebSockets to Django
      },
    ];
  },
};

export default nextConfig;
