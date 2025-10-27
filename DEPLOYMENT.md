# Deployment Guide

## Prerequisites

Before deploying, you need to set up the following services:

### 1. MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist all IP addresses (0.0.0.0/0) for Vercel
5. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/dbname`)

### 2. Pusher

1. Go to [Pusher](https://pusher.com/)
2. Create a new Channels app
3. Note down your credentials:
   - App ID
   - Key
   - Secret
   - Cluster

### 3. UploadThing

1. Go to [UploadThing](https://uploadthing.com/)
2. Create a new app
3. Get your credentials:
   - Secret
   - App ID
   - Token (optional)

## Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub, GitLab, or Bitbucket

2. Go to [Vercel](https://vercel.com/) and sign in

3. Click "Add New Project"

4. Import your repository

5. Configure environment variables:
   ```
   MONGODB_URI=mongodb+srv://...
   
   NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
   NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
   PUSHER_APP_ID=your_pusher_app_id
   PUSHER_KEY=your_pusher_key
   PUSHER_SECRET=your_pusher_secret
   PUSHER_CLUSTER=your_pusher_cluster
   
   UPLOADTHING_SECRET=your_uploadthing_secret
   UPLOADTHING_APP_ID=your_uploadthing_app_id
   UPLOADTHING_TOKEN=your_uploadthing_token
   
   NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
   ```

6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts and add environment variables when asked

5. For production deployment:
   ```bash
   vercel --prod
   ```

## Post-Deployment

### 1. Update NEXT_PUBLIC_SITE_URL

After your first deployment, update the `NEXT_PUBLIC_SITE_URL` environment variable with your actual Vercel URL:

1. Go to your project in Vercel Dashboard
2. Settings → Environment Variables
3. Update `NEXT_PUBLIC_SITE_URL` to your deployment URL (e.g., `https://your-app.vercel.app`)
4. Redeploy

### 2. Configure Custom Domain (Optional)

1. Go to your project in Vercel Dashboard
2. Settings → Domains
3. Add your custom domain
4. Follow DNS configuration instructions
5. Update `NEXT_PUBLIC_SITE_URL` to your custom domain

### 3. Test Your Deployment

1. Open your deployed URL
2. Test the following features:
   - [ ] Name selection and storage
   - [ ] Sending messages
   - [ ] Real-time message delivery (open in two browsers)
   - [ ] Theme switching
   - [ ] File uploads (images and documents)
   - [ ] Emoji reactions
   - [ ] Reply to messages
   - [ ] Edit messages (within 10 minutes)
   - [ ] Delete messages (within 10 minutes)
   - [ ] Mobile responsiveness
   - [ ] Country flag display

## Troubleshooting

### Messages not appearing in real-time

- Check Pusher credentials are correct
- Verify Pusher app is active
- Check browser console for WebSocket errors

### File uploads failing

- Verify UploadThing credentials
- Check file size limits (10MB for images, 25MB for documents)
- Ensure file types are supported

### Database connection errors

- Verify MongoDB connection string
- Check MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Ensure database user has read/write permissions

### Country flags not showing

- The app uses ip-api.com which is free but has rate limits
- For production, consider upgrading to a paid IP geolocation service
- Fallback globe emoji (🌐) will show if detection fails

## Monitoring

### Vercel Analytics

Enable Vercel Analytics for performance monitoring:

1. Go to your project in Vercel Dashboard
2. Analytics tab
3. Enable Web Analytics

### Error Tracking (Optional)

Consider integrating error tracking services like:
- Sentry
- LogRocket
- Datadog

Add the SDK to `app/layout.tsx` and configure error reporting.

## Scaling Considerations

### Database

- MongoDB Atlas free tier supports up to 512MB storage
- Upgrade to paid tier for more storage and better performance
- Consider implementing message retention policy (e.g., delete messages older than 30 days)

### Pusher

- Free tier: 200k messages/day, 100 concurrent connections
- Upgrade for higher limits
- Monitor usage in Pusher dashboard

### UploadThing

- Free tier: 2GB storage, 2GB bandwidth/month
- Upgrade for more storage and bandwidth
- Consider implementing file cleanup for old attachments

### Rate Limiting

Current implementation uses in-memory rate limiting (10 requests/minute per IP). For production at scale, consider:
- Redis-based rate limiting
- Upstash Rate Limiting
- Vercel Edge Config

## Security Checklist

- [ ] All environment variables are set in Vercel
- [ ] MongoDB IP whitelist is configured
- [ ] CORS is properly configured
- [ ] Rate limiting is active
- [ ] File upload size limits are enforced
- [ ] Input sanitization is working
- [ ] HTTPS is enabled (automatic with Vercel)

## Maintenance

### Regular Tasks

1. **Monitor database size**: Check MongoDB Atlas dashboard weekly
2. **Review Pusher usage**: Check for unusual spikes
3. **Check error logs**: Review Vercel logs for errors
4. **Update dependencies**: Run `npm update` monthly
5. **Backup database**: Export MongoDB data regularly

### Updating the App

1. Make changes locally
2. Test thoroughly
3. Push to your repository
4. Vercel will automatically deploy
5. Monitor deployment logs
6. Test production deployment

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Review browser console for client-side errors
3. Check MongoDB Atlas logs
4. Review Pusher debug console
5. Verify all environment variables are set correctly

## Cost Estimate

With free tiers:
- **Vercel**: Free (Hobby plan)
- **MongoDB Atlas**: Free (512MB)
- **Pusher**: Free (200k messages/day)
- **UploadThing**: Free (2GB storage)

**Total**: $0/month for moderate usage

For production with higher traffic, expect:
- **Vercel Pro**: $20/month
- **MongoDB Atlas**: $9-57/month
- **Pusher**: $49-299/month
- **UploadThing**: $10-50/month

**Total**: ~$88-426/month depending on usage
