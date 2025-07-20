#!/bin/bash

# Copy Real Cricket Scorer Application to Production
# Quick deployment of actual source files to replace placeholder

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
# Get the actual project directory from where the script is running
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
APP_USER="cricketapp"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Copying real Cricket Scorer application files..."

cd $APP_DIR

# Stop current application
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true

# Create backup of placeholder
if [ -d "client/src" ]; then
    mv client client.placeholder.backup.$(date +%Y%m%d_%H%M%S)
fi
if [ -d "server" ] && [ ! -f "server/cricket-rules.ts" ]; then
    mv server server.placeholder.backup.$(date +%Y%m%d_%H%M%S)
fi
if [ -d "shared" ] && [ ! -f "shared/schema.ts" ] || [ "$(wc -l < shared/schema.ts)" -lt 50 ]; then
    mv shared shared.placeholder.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy real source files from the development project
log "Copying client source files from $SOURCE_DIR..."
if [ -d "$SOURCE_DIR/client" ]; then
    cp -r $SOURCE_DIR/client .
    chown -R $APP_USER:$APP_USER client
    log "✅ Client files copied successfully"
else
    log "❌ Client directory not found at $SOURCE_DIR/client"
    exit 1
fi

log "Copying server source files..."
if [ -d "$SOURCE_DIR/server" ]; then
    cp -r $SOURCE_DIR/server .
    chown -R $APP_USER:$APP_USER server
    log "✅ Server files copied successfully"
else
    log "❌ Server directory not found at $SOURCE_DIR/server"
    exit 1
fi

log "Copying shared schema..."
if [ -d "$SOURCE_DIR/shared" ]; then
    cp -r $SOURCE_DIR/shared .
    chown -R $APP_USER:$APP_USER shared
    log "✅ Shared files copied successfully"
else
    log "❌ Shared directory not found at $SOURCE_DIR/shared"
    exit 1
fi

# Copy configuration files if they exist
if [ -f "$SOURCE_DIR/components.json" ]; then
    cp $SOURCE_DIR/components.json .
    chown $APP_USER:$APP_USER components.json
fi

# Rebuild application
log "Rebuilding application with real source files..."
sudo -u $APP_USER npm run build

# Restart application
log "Restarting Cricket Scorer with real application..."
sudo -u $APP_USER pm2 restart cricket-scorer

# Test application
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ Real Cricket Scorer application deployed successfully!"
    log "🌐 Visit: https://score.ramisetty.net"
    
    # Test if teams API has real data
    if curl -s http://localhost:5000/api/teams | grep -q "Chiefs"; then
        log "✅ API endpoints working with real data"
    fi
else
    log "⚠️ Application health check failed - checking logs..."
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 10
fi

log "🏏 Real Cricket Scorer deployment completed!"