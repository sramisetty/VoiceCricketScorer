#!/bin/bash

# Remote deployment script for Cricket Scorer
APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"
PACKAGE_NAME="cricket-scorer-production.tar.gz"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Deploying Cricket Scorer from package..."

# Stop current application
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true

cd $APP_DIR

# Backup current deployment
if [ -d "client" ]; then
    tar -czf backup-$(date +%Y%m%d_%H%M%S).tar.gz client server shared 2>/dev/null || true
fi

# Extract new application
log "Extracting application files..."
tar -xzf $PACKAGE_NAME

# Set ownership
chown -R $APP_USER:$APP_USER client server shared *.json *.ts *.js 2>/dev/null || true

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
    log "Installing dependencies..."
    sudo -u $APP_USER npm install --legacy-peer-deps
fi

# Build application
log "Building application..."
sudo -u $APP_USER npm run build

# Restart application
log "Starting Cricket Scorer..."
sudo -u $APP_USER pm2 restart cricket-scorer 2>/dev/null || sudo -u $APP_USER pm2 start ecosystem.config.cjs

# Test deployment
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ Cricket Scorer deployed successfully!"
    log "🌐 Available at: https://score.ramisetty.net"
else
    log "❌ Health check failed - checking logs..."
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 5
fi

# Clean up package
rm -f $PACKAGE_NAME

log "🏏 Deployment completed!"
