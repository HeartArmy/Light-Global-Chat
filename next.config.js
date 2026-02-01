/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
    ],
  },
  // Disable static optimization for pages that use client-side features
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), microphone=(), camera=(), fullscreen=(self)',
          },
          {
            key: 'x-vercel-analytics',
            value: 'true',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
