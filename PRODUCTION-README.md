# Cricket Scorer Production Deployment

## Current Situation

Your Cricket Scorer app is running perfectly in **development mode** here on Replit on port 5000. However, for production deployment on your server `67.227.251.94` with domain `score.ramisetty.net`, you need to deploy the actual application files.

## Production Deployment Steps

### 1. Copy Application Files to Production Server

First, you need to get your Cricket Scorer application code onto your production server. You have several options:

**Option A: Using SCP (if you have the files locally)**
```bash
scp -r /path/to/cricket-scorer root@67.227.251.94:/home/cricketapp/
```

**Option B: Using Git (recommended)**
```bash
# On your production server
git clone <your-repo-url> /home/cricketapp/cricket-scorer
```

**Option C: Download from Replit**
You can download the entire project as a ZIP file from Replit and upload it to your server.

### 2. Run the Production Deployment Script

Once the files are on your production server, run:

```bash
# On your production server (67.227.251.94)
sudo ./deploy-to-production.sh
```

This script will:
- Install Node.js and PM2 if needed
- Build the application for production
- Configure PM2 to run the app on port 5000
- Set up Nginx reverse proxy
- Configure SSL with Let's Encrypt

### 3. Alternative: Quick Manual Setup

If you prefer to set up manually:

```bash
# On your production server
cd /home/cricketapp/cricket-scorer
npm install
npm run build
pm2 start ecosystem.config.cjs
sudo systemctl reload nginx
sudo certbot --nginx -d score.ramisetty.net
```

## Why Your Current Setup Shows "No Ports Listening"

The diagnostic you ran earlier was checking your **development environment** (Replit), not your production server. Your PM2 process on the production server is running but might not have the correct application files or might be failing to start the server.

## Current Status

✅ **Development**: Cricket Scorer running perfectly on Replit port 5000  
✅ **Production Server**: Basic infrastructure (PM2, Nginx, SSL) is set up  
❌ **Production App**: Application files need to be deployed and built  

## Next Steps

1. **Deploy your application code** to the production server
2. **Run the deployment script** to build and start the production app
3. **Test the connection** at https://score.ramisetty.net

The key issue is that your production server has the infrastructure but not the actual Cricket Scorer application code that's currently running here on Replit.