#!/bin/bash

# Cricket Scorer Status Check Script
# Checks all components: PM2, Database, Nginx, SSL

set -euo pipefail

APP_DIR="/opt/cricket-scorer"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

echo "🏏 Cricket Scorer Production Status Check"
echo "========================================"

# 1. Check Application Directory
log "1. Checking application directory..."
if [ -d "$APP_DIR" ]; then
    log "✅ App directory exists: $APP_DIR"
    ls -la $APP_DIR | head -10
else
    error "❌ App directory not found: $APP_DIR"
fi

# 2. Check PM2 Status
log "2. Checking PM2 process..."
if sudo -u cricketapp pm2 status 2>/dev/null | grep -q cricket-scorer; then
    log "✅ PM2 process running"
    sudo -u cricketapp pm2 status
else
    warn "⚠️ PM2 process not found"
fi

# 3. Check Port Binding
log "3. Checking port 5000..."
if netstat -tlnp | grep -q ":5000"; then
    log "✅ Port 5000 is bound"
    netstat -tlnp | grep ":5000"
else
    warn "⚠️ Port 5000 not bound"
fi

# 4. Check API Health
log "4. Testing API endpoints..."
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ API health check passed"
    curl -s http://localhost:5000/api/health | jq . 2>/dev/null || echo "Response received"
else
    warn "⚠️ API health check failed"
fi

# 5. Check Database Connection
log "5. Checking PostgreSQL database..."
if systemctl is-active --quiet postgresql; then
    log "✅ PostgreSQL service running"
    sudo -u postgres psql -c "SELECT version();" 2>/dev/null | head -2 || warn "Database query failed"
else
    warn "⚠️ PostgreSQL service not running"
fi

# 6. Check Nginx Status
log "6. Checking Nginx..."
if systemctl is-active --quiet nginx; then
    log "✅ Nginx service running"
    nginx -t 2>&1 || warn "Nginx config test failed"
else
    warn "⚠️ Nginx service not running"
fi

# 7. Check SSL Certificate
log "7. Checking SSL certificate..."
if [ -f /etc/letsencrypt/live/score.ramisetty.net/fullchain.pem ]; then
    log "✅ SSL certificate exists"
    openssl x509 -in /etc/letsencrypt/live/score.ramisetty.net/fullchain.pem -text -noout | grep -E "Not After|Subject:" || warn "Could not read certificate"
else
    warn "⚠️ SSL certificate not found"
fi

# 8. Check External Access
log "8. Testing external access..."
if curl -s -k https://score.ramisetty.net/api/health | grep -q "ok"; then
    log "✅ External HTTPS access working"
else
    warn "⚠️ External HTTPS access failed"
fi

# 9. Check Logs
log "9. Recent application logs..."
sudo -u cricketapp pm2 logs cricket-scorer --lines 5 --nostream 2>/dev/null || warn "Could not retrieve PM2 logs"

echo ""
echo "🏏 Status Check Complete"
echo "========================================"

# Final recommendation
if netstat -tlnp | grep -q ":5000" && curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "🎉 Cricket Scorer appears to be running correctly!"
    log "🌐 Visit: https://score.ramisetty.net"
else
    error "❌ Cricket Scorer needs attention - check the warnings above"
fi