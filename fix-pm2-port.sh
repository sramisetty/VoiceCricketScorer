#!/bin/bash

# Fix PM2 Port Binding for Cricket Scorer
# This script fixes the issue where PM2 process runs but doesn't bind to ports

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Fixing PM2 port binding issue for Cricket Scorer..."

# Check current PM2 status
log "Current PM2 status:"
sudo -u cricketapp pm2 status

# Check PM2 logs for errors
log "Checking PM2 logs for errors..."
sudo -u cricketapp pm2 logs cricket-scorer --lines 20 || warn "Could not retrieve logs"

# Stop current PM2 process
log "Stopping current PM2 process..."
sudo -u cricketapp pm2 stop cricket-scorer || warn "Process already stopped"
sudo -u cricketapp pm2 delete cricket-scorer || warn "Process already deleted"

# Find the correct application directory
APP_DIR="/opt/cricket-scorer"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="/opt/cricket-scorer"
    if [ ! -d "$APP_DIR" ]; then
        log "Looking for cricket-scorer directory..."
        APP_DIR=$(find / -name "cricket-scorer" -type d 2>/dev/null | head -1)
        if [ -z "$APP_DIR" ]; then
            warn "Cannot find cricket-scorer directory"
            exit 1
        fi
    fi
fi

log "Using app directory: $APP_DIR"

# Create new ecosystem.config.cjs with correct settings
cat > $APP_DIR/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    cwd: '/opt/cricket-scorer',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://cricket_user:cricketpass123@localhost:5432/cricket_scorer'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: '5000'
    },
    max_memory_restart: '500M',
    error_file: '/home/cricketapp/logs/cricket-scorer-error.log',
    out_file: '/home/cricketapp/logs/cricket-scorer-out.log',
    log_file: '/home/cricketapp/logs/cricket-scorer-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    merge_logs: true
  }]
}
EOF

# Ensure log directory exists
mkdir -p /home/cricketapp/logs
chown -R cricketapp:cricketapp /home/cricketapp/logs

# Ensure the built application exists
if [ ! -f "$APP_DIR/dist/index.js" ]; then
    log "Building the application..."
    cd $APP_DIR
    sudo -u cricketapp npm run build
fi

# Set correct ownership
chown -R cricketapp:cricketapp $APP_DIR

# Start PM2 with new configuration
log "Starting Cricket Scorer with PM2..."
cd $APP_DIR
sudo -u cricketapp PORT=5000 NODE_ENV=production pm2 start ecosystem.config.cjs

# Wait a moment for startup
sleep 5

# Check if port is now listening
if netstat -tlnp | grep :5000; then
    log "✓ Cricket Scorer is now listening on port 5000"
else
    warn "Port 5000 still not listening. Checking logs..."
    sudo -u cricketapp pm2 logs cricket-scorer --lines 10
fi

# Check PM2 status
sudo -u cricketapp pm2 status

# Save PM2 configuration
sudo -u cricketapp pm2 save

log "✓ PM2 port binding fix completed"
log "🏏 Cricket Scorer should now be accessible on port 5000"