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
            key: 'Content-Security-Policy',
            value: "default-src 'self' * 'unsafe-inline' 'unsafe-eval'; script-src 'self' * 'unsafe-inline' 'unsafe-eval'; connect-src 'self' * wss: ws:; img-src 'self' * data: blob: 'unsafe-inline'; frame-src 'self' *; style-src 'self' * 'unsafe-inline';",
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), microphone=(), camera=(), fullscreen=(self)',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
