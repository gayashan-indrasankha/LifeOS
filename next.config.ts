import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 60,
    },
  },
  ...(process.env.HABITFLOW_E2E_ISOLATED ? { distDir: '.next-e2e' } : {}),
};

export default nextConfig;
