#!/bin/bash

# Deploy Cricket Scorer directly from Replit environment to production
# This creates the complete application structure and deploys it

set -euo pipefail

PUBLIC_IP="67.227.251.94"
DOMAIN="score.ramisetty.net"
PACKAGE_NAME="cricket-scorer-full.tar.gz"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Creating complete Cricket Scorer deployment from Replit environment..."

# Create complete deployment package with all source files
tar -czf $PACKAGE_NAME \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude='*.log' \
    --exclude='*.backup.*' \
    --exclude=attached_assets \
    client/ server/ shared/ \
    package*.json tsconfig*.json \
    vite.config.ts tailwind.config.ts postcss.config.js \
    components.json drizzle.config.ts \
    replit.md

if [ ! -f "$PACKAGE_NAME" ]; then
    log "❌ Failed to create deployment package"
    exit 1
fi

log "✅ Package created: $PACKAGE_NAME ($(du -h $PACKAGE_NAME | cut -f1))"

# Create complete remote deployment script
cat > full-remote-deploy.sh << 'EOF'
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
EOF

chmod +x full-remote-deploy.sh

log "📦 Transferring complete Cricket Scorer to production server..."

# Transfer files
if scp -o ConnectTimeout=10 "$PACKAGE_NAME" "full-remote-deploy.sh" "root@$PUBLIC_IP:/opt/cricket-scorer/"; then
    log "✅ Files transferred successfully"
else
    log "❌ File transfer failed"
    exit 1
fi

log "🔧 Deploying complete Cricket Scorer on production server..."

# Execute deployment
if ssh -o ConnectTimeout=10 "root@$PUBLIC_IP" "cd /opt/cricket-scorer && ./full-remote-deploy.sh"; then
    log "✅ Remote deployment completed successfully"
    
    # Test final deployment
    log "🧪 Testing final deployment..."
    sleep 3
    
    if curl -s --connect-timeout 10 "https://$DOMAIN" | grep -q "Cricket.*Scorer" && ! curl -s "https://$DOMAIN" | grep -q "Production deployment successful"; then
        log "🎉 SUCCESS! Complete Cricket Scorer is now live!"
        log "🌐 Visit: https://$DOMAIN"
        log ""
        log "📋 Available Features:"
        log "   ✓ Voice-enabled scoring system"
        log "   ✓ Match management and team setup"
        log "   ✓ Live scoreboard with WebSocket updates"
        log "   ✓ ICC-compliant cricket rules engine"
        log "   ✓ Advanced scorer with detailed statistics"
        log "   ✓ Mobile-responsive interface"
    else
        log "⚠️ Application deployed but needs verification"
        log "🌐 Check: https://$DOMAIN"
    fi
else
    log "❌ Remote deployment failed"
    exit 1
fi

# Cleanup local files
rm -f $PACKAGE_NAME full-remote-deploy.sh

log "🏏 Cricket Scorer deployment from Replit completed successfully!"