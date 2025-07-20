#!/bin/bash

# Package and Deploy Cricket Scorer to Production
# Creates a deployment package and transfers it to production server

set -euo pipefail

DOMAIN="score.ramisetty.net"
PUBLIC_IP="67.227.251.94"
PACKAGE_NAME="cricket-scorer-production.tar.gz"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Creating Cricket Scorer production deployment package..."

# Check if required directories exist
if [ ! -d "client" ] || [ ! -d "server" ] || [ ! -d "shared" ]; then
    log "❌ Required directories not found in current location"
    log "Current directory: $(pwd)"
    log "Available files:"
    ls -la
    exit 1
fi

# Create deployment package
tar -czf $PACKAGE_NAME \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude='*.log' \
    --exclude='*.backup.*' \
    client/ server/ shared/ \
    package*.json tsconfig*.json \
    vite.config.ts tailwind.config.ts postcss.config.js \
    components.json drizzle.config.ts \
    master-deploy.sh 2>/dev/null || {
        log "❌ Failed to create package - checking what files exist..."
        log "Available files and directories:"
        find . -maxdepth 2 -type d -o -name "*.json" -o -name "*.ts" -o -name "*.js" | head -20
        exit 1
    }

log "✅ Package created: $PACKAGE_NAME ($(du -h $PACKAGE_NAME | cut -f1))"

# Create remote deployment script
cat > remote-deploy.sh << 'EOF'
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
EOF

chmod +x remote-deploy.sh

log "📦 Deployment package ready!"
log "📋 Next steps:"
log "1. Transfer package to server: scp $PACKAGE_NAME root@$PUBLIC_IP:/opt/cricket-scorer/"
log "2. Transfer deploy script: scp remote-deploy.sh root@$PUBLIC_IP:/opt/cricket-scorer/"
log "3. SSH to server: ssh root@$PUBLIC_IP"
log "4. Run deployment: cd /opt/cricket-scorer && sudo ./remote-deploy.sh"
log ""
log "Or run this complete command:"
echo "scp $PACKAGE_NAME remote-deploy.sh root@$PUBLIC_IP:/opt/cricket-scorer/ && ssh root@$PUBLIC_IP 'cd /opt/cricket-scorer && ./remote-deploy.sh'"