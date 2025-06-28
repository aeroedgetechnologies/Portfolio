# 🚀 Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **MongoDB Atlas** (Optional): For persistent data storage

## Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub with the following structure:
```
chat-application/
├── src/
├── server/
├── package.json
├── vercel.json
└── vite.config.ts
```

## Step 2: Environment Variables Setup

### Option A: MongoDB Atlas (Recommended for Production)

1. Create a MongoDB Atlas account at [mongodb.com](https://mongodb.com)
2. Create a new cluster
3. Get your connection string
4. In Vercel, add these environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string for JWT tokens
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID (if using Google login)

### Option B: In-Memory Storage (Default)

If you don't set `MONGODB_URI`, the app will use in-memory storage (data will be lost on server restart).

## Step 3: Deploy to Vercel

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new
   - Set project name
   - Confirm deployment settings

### Method 2: GitHub Integration

1. **Connect GitHub to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add the variables mentioned in Step 2

4. **Deploy**:
   - Click "Deploy"

## Step 4: Configure Domain (Optional)

1. **Custom Domain**:
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Subdomain**:
   - Vercel provides a `.vercel.app` subdomain by default
   - You can customize it in Project Settings

## Step 5: Verify Deployment

1. **Check Frontend**: Your React app should be accessible at your Vercel URL
2. **Check Backend**: API endpoints should work at `your-domain.vercel.app/api/*`
3. **Check WebSocket**: Socket.IO should work for real-time chat

## Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in `package.json`
   - Verify TypeScript compilation

2. **API Errors**:
   - Check environment variables are set correctly
   - Verify MongoDB connection string format
   - Check server logs in Vercel dashboard

3. **WebSocket Issues**:
   - Vercel supports WebSocket connections
   - Ensure Socket.IO is properly configured
   - Check CORS settings

4. **File Upload Issues**:
   - Vercel uses `/tmp` directory for file uploads
   - Files are temporary and will be deleted
   - Consider using external storage (AWS S3, Cloudinary) for production

### Performance Optimization:

1. **Enable Caching**:
   - Add cache headers in `vercel.json`
   - Use CDN for static assets

2. **Database Optimization**:
   - Use MongoDB Atlas for better performance
   - Implement proper indexing

3. **Image Optimization**:
   - Use Vercel's image optimization
   - Compress images before upload

## Production Checklist

- [ ] Environment variables configured
- [ ] MongoDB Atlas connected (if using)
- [ ] Google OAuth configured (if using)
- [ ] Custom domain set up (optional)
- [ ] SSL certificate enabled
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] Backup strategy in place

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **Socket.IO**: [socket.io/docs](https://socket.io/docs)

## Notes

- **Serverless Functions**: Vercel uses serverless functions with a 10-second timeout
- **File Storage**: Use external storage for production file uploads
- **Database**: MongoDB Atlas is recommended for production data persistence
- **Scaling**: Vercel automatically scales based on traffic

Your chat application is now ready for production! 🎉 