# Global Live Room

A real-time global chat room application with beautiful, minimalist design inspired by Apple's design philosophy.

## Features

- 🌐 **Real-time messaging** - Instant message delivery using Pusher WebSocket
- 🎨 **Dark/Light themes** - Seamless theme switching with system preference detection
- 👤 **No authentication required** - Join with just a display name
- 🌍 **Country flags** - Automatic country detection from IP address
- 💬 **Rich messaging** - Text, links, images, and file attachments
- ↩️ **Reply threading** - Reply to specific messages with context
- 😊 **Emoji reactions** - Quick reactions and extended emoji palette
- ✏️ **Edit/Delete** - Edit or delete messages within 10 minutes
- 📱 **Mobile-first** - Touch gestures, responsive design, optimized for all devices
- ⚡ **Fast & lightweight** - Optimized bundle size, code splitting, lazy loading

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Real-time**: Pusher Channels (WebSocket)
- **Database**: MongoDB with Mongoose ODM
- **File Storage**: UploadThing
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB database (MongoDB Atlas recommended)
- Pusher account and app
- UploadThing account

### Environment Variables

Create a `.env.local` file in the root directory:

\`\`\`env
# MongoDB
MONGODB_URI=your_mongodb_uri

# Pusher
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster

# UploadThing
UPLOADTHING_SECRET=your_uploadthing_secret
UPLOADTHING_APP_ID=your_uploadthing_app_id
UPLOADTHING_TOKEN=your_uploadthing_token

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
\`\`\`

### Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Import your repository in Vercel

3. Configure environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`

4. Deploy!

The app will automatically deploy on every push to your main branch.

## Project Structure

\`\`\`
├── app/
│   ├── api/              # API routes
│   │   ├── country/      # Country detection
│   │   ├── messages/     # Message CRUD
│   │   ├── reactions/    # Emoji reactions
│   │   └── uploadthing/  # File uploads
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main chat room
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── EmojiPicker.tsx
│   ├── ErrorBoundary.tsx
│   ├── MessageActions.tsx
│   ├── MessageInput.tsx
│   ├── MessageItem.tsx
│   ├── MessageList.tsx
│   ├── NameModal.tsx
│   └── ThemeProvider.tsx
├── lib/                  # Utility functions
│   ├── country.ts        # Country detection
│   ├── gestures.ts       # Touch gestures
│   ├── mongodb.ts        # Database connection
│   ├── pusher.ts         # Pusher instance
│   ├── security.ts       # Security utilities
│   ├── uploadthing.ts    # UploadThing helpers
│   └── utils.ts          # General utilities
├── models/               # Database models
│   └── Message.ts
├── types/                # TypeScript types
│   └── index.ts
└── middleware.ts         # Next.js middleware
\`\`\`

## Features in Detail

### Real-time Messaging
Messages are delivered instantly to all connected users via Pusher WebSocket. The app handles connection states and automatically reconnects on disconnection.

### Theme System
The app supports both dark and light themes with smooth transitions. Theme preference is saved to localStorage and respects system preferences by default.

### File Attachments
- Images (JPEG, PNG, GIF, WEBP) up to 10MB - displayed inline
- Documents (PDF, DOC, DOCX, TXT) up to 25MB - shown as download links

### Message Actions
- **Reply**: Click reply or swipe right on mobile to reply to a message
- **React**: Quick reactions (👍, ❤️, 😂, 😮, 😢) or choose from 50+ emojis
- **Edit**: Edit your messages within 10 minutes
- **Delete**: Delete your messages within 10 minutes (with confirmation)

### Mobile Optimizations
- Touch gestures: swipe right to reply, long press for actions
- Responsive layout adapts from 320px to 2560px
- 44px minimum tap targets for accessibility
- Virtual keyboard handling
- Native file picker integration

### Security
- Input sanitization to prevent XSS attacks
- Rate limiting (10 requests per minute per IP)
- File type and size validation
- CORS configuration
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)

## Performance

The app is optimized for speed and efficiency:
- Initial bundle size < 200KB (gzipped)
- Code splitting and lazy loading
- Virtual scrolling for large message lists
- Image optimization with Next.js Image component
- Efficient caching strategies

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- iOS Safari
- Android Chrome

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
