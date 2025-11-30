import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/ThemeProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import JsonLd from './jsonld';
import './globals.css';
import '@/lib/console-patch'; // Import console patch to intercept all logs and send to Logflare
import '@/lib/logger'; // Import logger to enable console interception for MongoDB

export const metadata: Metadata = {
  title: 'Global Live Chat Room - Free Real-Time Chat Room | Live Chat Online',
  description: 'Join Global Live Chat Room - a free, real-time chat room for instant messaging worldwide. No signup required. Chat with people globally, share files, react with emojis. Beautiful, fast, and mobile-friendly live chat.',
  keywords: [
    'Global Live Chat Room',
    'chat room',
    'live chat',
    'free chat room',
    'online chat',
    'real-time chat',
    'instant messaging',
    'global chat',
    'live room',
    'chat online',
    'free live chat',
    'group chat',
    'public chat room',
    'anonymous chat',
    'web chat',
  ],
  authors: [{ name: 'Global Live Chat Room' }],
  creator: 'Global Live Chat Room',
  publisher: 'Global Live Chat Room',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Global Live Chat Room - Free Real-Time Chat Room',
    description: 'Join the global conversation! Free real-time chat room with instant messaging, file sharing, and emoji reactions. No signup required.',
    url: '/',
    siteName: 'Global Live Chat Room',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Global Live Chat Room - Real-Time Chat',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global Live Chat Room - Free Real-Time Chat Room',
    description: 'Join the global conversation! Free real-time chat with instant messaging, file sharing, and emoji reactions.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd />
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
