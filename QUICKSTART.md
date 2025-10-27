# Quick Start Guide

Get your Global Live Room up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git

## Step 1: Clone and Install (2 minutes)

```bash
# Install dependencies
npm install
```

## Step 2: Set Up Services (2 minutes)

You need three free accounts:

### MongoDB Atlas (Database)
1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up and create a free cluster
3. Create a database user
4. Get connection string

### Pusher (Real-time)
1. Go to https://pusher.com/
2. Sign up and create a Channels app
3. Copy your credentials

### UploadThing (File Storage)
1. Go to https://uploadthing.com/
2. Sign up and create an app
3. Copy your credentials

## Step 3: Configure Environment (1 minute)

Create `.env.local` file:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatroom

# Pusher
NEXT_PUBLIC_PUSHER_KEY=your_key_here
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key_here
PUSHER_SECRET=your_secret_here
PUSHER_CLUSTER=mt1

# UploadThing
UPLOADTHING_SECRET=sk_live_xxxxx
UPLOADTHING_APP_ID=xxxxx
UPLOADTHING_TOKEN=xxxxx

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Step 4: Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 🎉

## Step 5: Test Features

1. Enter a display name
2. Send a message
3. Open in another browser/tab
4. See real-time updates!
5. Try uploading an image
6. Add emoji reactions
7. Reply to a message
8. Toggle dark/light theme

## Deploy to Vercel (Optional)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts and add environment variables
```

## Troubleshooting

### "Cannot connect to database"
- Check MongoDB connection string
- Ensure IP whitelist includes 0.0.0.0/0

### "Messages not appearing in real-time"
- Verify Pusher credentials
- Check browser console for errors

### "File upload failed"
- Verify UploadThing credentials
- Check file size (10MB for images, 25MB for files)

## What's Next?

- Read [README.md](README.md) for full documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Review [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for technical details

## Need Help?

- Check browser console for errors
- Review Vercel deployment logs
- Verify all environment variables are set
- Ensure all services are active

---

**Happy chatting! 💬**
