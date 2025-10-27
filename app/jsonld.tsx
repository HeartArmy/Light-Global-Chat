export default function JsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Global Live Chat Room',
    description: 'Free real-time global chat room with instant messaging, file sharing, and emoji reactions. No signup required.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    applicationCategory: 'CommunicationApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Real-time messaging',
      'File sharing',
      'Emoji reactions',
      'Reply to messages',
      'Dark/Light theme',
      'Mobile friendly',
      'No signup required',
      'Global chat room',
    ],
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    softwareVersion: '1.0',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      ratingCount: '1',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
