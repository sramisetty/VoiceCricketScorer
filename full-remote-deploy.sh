#!/bin/bash

# Complete Cricket Scorer remote deployment
APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"
PACKAGE_NAME="cricket-scorer-full.tar.gz"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Deploying complete Cricket Scorer application..."

# Stop current application
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true
sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true

cd $APP_DIR

# Backup existing deployment
if [ -d "client" ]; then
    log "Creating backup of current deployment..."
    tar -czf backup-$(date +%Y%m%d_%H%M%S).tar.gz client server shared package.json 2>/dev/null || true
fi

# Clean existing directories
rm -rf client server shared package.json tsconfig.json vite.config.ts

# Extract new application
log "Extracting Cricket Scorer application files..."
tar -xzf $PACKAGE_NAME

# Set correct ownership
chown -R $APP_USER:$APP_USER client server shared *.json *.ts *.js 2>/dev/null || true

# Install dependencies
log "Installing dependencies..."
sudo -u $APP_USER npm install --legacy-peer-deps

# Build application
log "Building Cricket Scorer application..."
sudo -u $APP_USER npm run build

# Start application with PM2
log "Starting Cricket Scorer with PM2..."
sudo -u $APP_USER pm2 start ecosystem.config.cjs

# Test deployment
sleep 5
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ Cricket Scorer deployed successfully!"
    log "🌐 Available at: https://score.ramisetty.net"
    
    # Test if we have real cricket data
    if curl -s http://localhost:5000/api/teams | grep -q "name"; then
        log "✅ Cricket Scorer APIs working with real data"
    else
        log "⚠️ APIs deployed but may need data initialization"
    fi
else
    log "❌ Health check failed - checking logs..."
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 10
    exit 1
fi

# Clean up package
rm -f $PACKAGE_NAME

log "🏏 Complete Cricket Scorer deployment successful!"
