#!/bin/bash

# Nginx Configuration Fix for Cricket Scorer
# Properly configures nginx to serve the application on score.ramisetty.net

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
    exit 1
fi

APP_NAME="cricket-scorer"

log "Configuring Nginx for Cricket Scorer application..."

# Check if PM2 application is running
if pm2 list | grep -q "$APP_NAME.*online"; then
    success "Cricket Scorer application is running on PM2"
else
    error "Cricket Scorer application is not running on PM2"
    log "Starting application with PM2..."
    cd /opt/cricket-scorer
    pm2 start ecosystem.config.cjs --env production
    sleep 5
    
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application started successfully"
    else
        error "Failed to start application"
        exit 1
    fi
fi

# Test if application responds on localhost:3000
log "Testing application response..."
if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
    success "Application is responding on localhost:3000"
else
    error "Application is not responding on localhost:3000"
    log "Application logs:"
    pm2 logs $APP_NAME --lines 10
    exit 1
fi

# Create proper nginx configuration for cricket scorer
log "Creating nginx configuration for score.ramisetty.net..."

cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name score.ramisetty.net www.score.ramisetty.net;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Main application proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    # WebSocket support for real-time features
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Check nginx directory structure
if [ ! -d "/etc/nginx/sites-available" ]; then
    log "Creating nginx sites directories..."
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
fi

# Remove default nginx configurations that might be interfering
log "Removing default nginx configurations..."
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/cricket-scorer
rm -f /etc/nginx/conf.d/default.conf

# Handle different nginx configurations on different systems
if [ -f "/etc/nginx/nginx.conf" ]; then
    # Check if nginx.conf includes sites-enabled
    if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
        log "Adding sites-enabled include to nginx.conf..."
        # Add include directive before the last closing brace
        sed -i '/^}/i\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    fi
    
    # Also create direct configuration in conf.d as fallback
    log "Creating fallback configuration in conf.d..."
    cp /etc/nginx/sites-available/$APP_NAME /etc/nginx/conf.d/$APP_NAME.conf
else
    error "Nginx configuration file not found"
    exit 1
fi

# Enable cricket scorer site
log "Enabling cricket scorer site..."
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME

# Test nginx configuration
log "Testing nginx configuration..."
if nginx -t; then
    success "Nginx configuration is valid"
else
    error "Nginx configuration test failed"
    nginx -t
    exit 1
fi

# Restart nginx
log "Restarting nginx..."
systemctl restart nginx

# Wait for nginx to start
sleep 3

if systemctl is-active --quiet nginx; then
    success "Nginx restarted successfully"
else
    error "Nginx failed to restart"
    systemctl status nginx
    exit 1
fi

# Test the final configuration
log "Testing final configuration..."

# Test local access
if curl -f -s -H "Host: score.ramisetty.net" http://localhost/ >/dev/null 2>&1; then
    success "Local nginx proxy test passed"
else
    error "Local nginx proxy test failed"
    log "Nginx error log:"
    tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
fi

# Show current nginx configuration
log "Current nginx sites enabled:"
ls -la /etc/nginx/sites-enabled/

log "Current PM2 status:"
pm2 status

# Final verification and troubleshooting
log "Final verification steps..."

# Show what's actually being served
log "Testing what nginx is actually serving..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: score.ramisetty.net" http://localhost/ 2>/dev/null || echo "000")
log "HTTP response code: $RESPONSE"

if [ "$RESPONSE" = "200" ]; then
    success "Nginx is serving content successfully"
else
    warning "Nginx may not be serving the application correctly"
    
    # Show nginx configuration for debugging
    log "Current nginx configuration:"
    cat /etc/nginx/sites-available/$APP_NAME | head -20
    
    log "Nginx includes:"
    grep -n "include" /etc/nginx/nginx.conf || echo "No includes found"
    
    log "Active nginx configurations:"
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "No sites-enabled directory"
    ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "No conf.d directory"
fi

success "Nginx configuration completed!"
log "Your cricket scorer should now be accessible at:"
log "  http://score.ramisetty.net"
log "  https://score.ramisetty.net (if SSL is configured)"
log ""
log "If still showing test page, try:"
log "  1. Clear browser cache (Ctrl+F5)"
log "  2. Wait 30 seconds for DNS/cache to clear"
log "  3. Check: curl -H 'Host: score.ramisetty.net' http://YOUR_SERVER_IP/"