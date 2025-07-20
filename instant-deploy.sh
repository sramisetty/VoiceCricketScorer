#!/bin/bash

# Instant Cricket Scorer Deployment
# Combines package creation and remote deployment in one command

set -euo pipefail

PUBLIC_IP="67.227.251.94"
DOMAIN="score.ramisetty.net"
PACKAGE_NAME="cricket-scorer-production.tar.gz"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Starting instant Cricket Scorer deployment..."

# Verify package exists
if [ ! -f "$PACKAGE_NAME" ]; then
    log "❌ Package not found. Creating deployment package first..."
    ./package-and-deploy.sh
fi

# Verify remote deploy script exists
if [ ! -f "remote-deploy.sh" ]; then
    log "❌ Remote deploy script missing"
    exit 1
fi

log "📦 Transferring Cricket Scorer package to production server..."

# Transfer files to production server
if scp -o ConnectTimeout=10 "$PACKAGE_NAME" "remote-deploy.sh" "root@$PUBLIC_IP:/opt/cricket-scorer/"; then
    log "✅ Files transferred successfully"
else
    log "❌ File transfer failed. Please check:"
    log "   - SSH key authentication is set up"
    log "   - Server $PUBLIC_IP is accessible"
    log "   - You have root access"
    exit 1
fi

log "🔧 Deploying Cricket Scorer application on production server..."

# Execute remote deployment
if ssh -o ConnectTimeout=10 "root@$PUBLIC_IP" "cd /opt/cricket-scorer && chmod +x remote-deploy.sh && ./remote-deploy.sh"; then
    log "✅ Remote deployment completed"
    
    # Test the deployment
    log "🧪 Testing deployment..."
    sleep 5
    
    if curl -s --connect-timeout 10 "https://$DOMAIN" | grep -q "Cricket.*Scorer" && ! curl -s "https://$DOMAIN" | grep -q "Production deployment successful"; then
        log "🎉 SUCCESS! Cricket Scorer deployed and running!"
        log "🌐 Visit: https://$DOMAIN"
        log "📊 Features now available:"
        log "   - Voice-enabled scoring system"
        log "   - Match management interface"
        log "   - Live scoreboard with WebSocket updates"
        log "   - ICC-compliant cricket rules"
        log "   - Real-time match statistics"
    else
        log "⚠️  Application deployed but may need verification"
        log "🌐 Check: https://$DOMAIN"
        log "📋 If issues persist, check server logs:"
        log "   ssh root@$PUBLIC_IP 'pm2 logs cricket-scorer'"
    fi
else
    log "❌ Remote deployment failed"
    log "🔍 Try manual deployment:"
    log "   ssh root@$PUBLIC_IP"
    log "   cd /opt/cricket-scorer"
    log "   ./remote-deploy.sh"
    exit 1
fi

log "🏏 Cricket Scorer instant deployment completed!"