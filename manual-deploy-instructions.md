# Manual Cricket Scorer Deployment Instructions

## Files Ready for Deployment

✅ **cricket-scorer-full.tar.gz** (172K) - Complete Cricket Scorer application package
✅ **full-remote-deploy.sh** - Remote deployment script

## Deployment Steps

### Option 1: Direct Server Commands (If you have SSH access)

1. **Download the deployment package from Replit:**
   - Download `cricket-scorer-full.tar.gz`
   - Download `full-remote-deploy.sh`

2. **Transfer to production server:**
   ```bash
   scp cricket-scorer-full.tar.gz full-remote-deploy.sh root@67.227.251.94:/opt/cricket-scorer/
   ```

3. **SSH to server and deploy:**
   ```bash
   ssh root@67.227.251.94
   cd /opt/cricket-scorer
   chmod +x full-remote-deploy.sh
   ./full-remote-deploy.sh
   ```

### Option 2: Using Replit Terminal (Alternative)

If you have terminal access on a local machine with SSH:

1. **Copy the deployment commands:**
   ```bash
   # Download files from your Replit (use Replit's download feature)
   # Then upload to server:
   scp cricket-scorer-full.tar.gz full-remote-deploy.sh root@67.227.251.94:/opt/cricket-scorer/
   ssh root@67.227.251.94 'cd /opt/cricket-scorer && chmod +x full-remote-deploy.sh && ./full-remote-deploy.sh'
   ```

### What This Will Do

The deployment will:

1. **Stop** current placeholder application
2. **Backup** existing deployment 
3. **Extract** your complete Cricket Scorer source code
4. **Install** dependencies with proper configuration
5. **Build** the full application
6. **Start** with PM2 process manager
7. **Test** deployment success

## Expected Result

After successful deployment, **https://score.ramisetty.net** will show:

- Complete match management interface
- Voice-enabled scoring system
- Live scoreboard with WebSocket updates
- Team and player management
- Real-time statistics dashboard
- ICC-compliant cricket rules engine

## Verification

Check deployment success:
- Visit: https://score.ramisetty.net
- Should see full Cricket Scorer interface instead of "Production deployment successful!" message
- Test voice commands and match creation features

## Troubleshooting

If deployment fails:
```bash
ssh root@67.227.251.94
pm2 logs cricket-scorer
```

This will show any error messages from the application startup.