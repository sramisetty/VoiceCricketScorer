#!/bin/bash

# Quick Nginx Setup for Cricket Scorer
# Fixes the 502 Bad Gateway by pointing to correct port

set -euo pipefail

DOMAIN="score.ramisetty.net"
APP_PORT="5000"  # Correct port from your app

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

log "Fixing Nginx configuration for Cricket Scorer..."

# Remove existing configurations
rm -f /etc/nginx/conf.d/cricket-scorer.conf
rm -f /etc/nginx/sites-available/cricket-scorer
rm -f /etc/nginx/sites-enabled/cricket-scorer

# Create HTTP configuration with correct port
cat > /etc/nginx/conf.d/cricket-scorer.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # WebSocket support for live updates
    location /ws {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:$APP_PORT;
        access_log off;
    }
}
EOF

# Test configuration
log "Testing Nginx configuration..."
nginx -t

# Reload Nginx
systemctl reload nginx
log "✓ Nginx reloaded with corrected configuration"

# Test the connection
sleep 2
if curl -s -I http://$DOMAIN | head -1 | grep -q "200\|301\|302"; then
    log "✓ HTTP is working properly"
    log "🏏 Cricket Scorer is now available at: http://$DOMAIN"
    log ""
    log "Next step: Run SSL setup"
    log "sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN --redirect"
else
    log "⚠️  Connection test failed - check if your app is running on port $APP_PORT"
    log "Check with: sudo netstat -tlnp | grep :$APP_PORT"
fi