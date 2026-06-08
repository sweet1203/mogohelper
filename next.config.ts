import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    // html2canvas는 브라우저 전용 패키지 — 서버 번들에서 제외
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'html2canvas'];
    }
    return config;
  },
};

export default nextConfig;
