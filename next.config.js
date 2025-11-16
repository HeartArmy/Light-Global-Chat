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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com wss://ws-ap2.pusher.com https://sockjs-ap2.pusher.com https://uploadthing-prod-sea1.s3.us-west-2.amazonaws.com; frame-src 'self' https://www.youtube-nocookie.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
