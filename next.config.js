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
}

module.exports = nextConfig
