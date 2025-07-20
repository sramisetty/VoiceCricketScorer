# PM2 Production Setup for Cricket Scorer

## PM2 Configuration Generated

The `ecosystem.config.cjs` file has been created with the following features:

### Configuration Details

- **App Name**: cricket-scorer
- **Entry Point**: dist/index.js (built server)
- **Clustering**: Uses all CPU cores for maximum performance
- **Auto-restart**: Enabled with smart restart policies
- **Logging**: Structured logs to ./logs/ directory
- **Memory Limit**: 1GB restart threshold
- **Health Monitoring**: Built-in uptime and restart limits

### Production Commands

```bash
# 1. Create logs directory
mkdir -p logs

# 2. Build application for production
npx vite build --outDir server/public --emptyOutDir
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# 3. Start with PM2
pm2 start ecosystem.config.cjs --env production

# 4. Save PM2 configuration
pm2 save

# 5. Setup PM2 to start on boot
pm2 startup
```

### PM2 Management Commands

```bash
# Monitor application
pm2 monit

# View logs
pm2 logs cricket-scorer

# Restart application
pm2 restart cricket-scorer

# Stop application
pm2 stop cricket-scorer

# Delete application
pm2 delete cricket-scorer

# Reload configuration
pm2 reload ecosystem.config.cjs
```

### Key Features

1. **Cluster Mode**: Runs multiple instances across all CPU cores
2. **Auto-restart**: Restarts on crashes with intelligent backoff
3. **Memory Management**: Restarts if memory exceeds 1GB
4. **Log Management**: Separate error, output, and combined logs
5. **Zero-downtime Deploys**: Reload without service interruption
6. **Health Monitoring**: Tracks uptime and restart counts

### File Structure Expected

```
/opt/cricket-scorer/
├── dist/index.js          # Built server (PM2 entry point)
├── server/public/         # Built client files (Express static)
├── .env                   # Environment variables
├── ecosystem.config.cjs   # PM2 configuration
└── logs/                  # PM2 log files
```

### Deployment Integration

The configuration includes automatic deployment from GitHub repository with post-deploy hooks that:
- Install dependencies
- Build client and server
- Reload PM2 processes
- Maintain zero downtime

This setup ensures your Cricket Scorer application runs reliably in production with automatic scaling and monitoring.