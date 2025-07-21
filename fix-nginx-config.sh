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

# Remove default nginx site and enable cricket scorer
log "Enabling cricket scorer site and disabling default..."
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/cricket-scorer
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

success "Nginx configuration completed!"
log "Your cricket scorer should now be accessible at:"
log "  http://score.ramisetty.net"
log "  https://score.ramisetty.net (if SSL is configured)"