#!/bin/bash

# Complete PM2 Startup Configuration
# This script configures PM2 to auto-start on system boot

set -euo pipefail

APP_USER="cricketapp"

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Configuring PM2 startup for Cricket Scorer..."

# Generate and run the PM2 startup command
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

log "✓ PM2 startup configuration completed"
log "✓ Cricket Scorer will now auto-start on system reboot"

# Show final PM2 status
log "Current PM2 status:"
sudo -u $APP_USER pm2 status

log "🏏 Cricket Scorer deployment completed successfully!"
log "Application is running on port 3000"