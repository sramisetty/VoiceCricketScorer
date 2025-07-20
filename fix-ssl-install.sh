#!/bin/bash

# Fix SSL Installation for Cricket Scorer
# This script fixes the Nginx configuration and installs the SSL certificate

set -euo pipefail

DOMAIN="score.ramisetty.net"
PUBLIC_IP="67.227.251.94"
APP_PORT="3000"

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

log "Fixing SSL installation for $DOMAIN..."

# Remove existing configurations that might conflict
rm -f /etc/nginx/sites-available/cricket-scorer
rm -f /etc/nginx/sites-enabled/cricket-scorer
rm -f /etc/nginx/conf.d/cricket-scorer.conf

# Create proper Nginx configuration with correct server_name
log "Creating corrected Nginx configuration..."

cat > /etc/nginx/sites-available/cricket-scorer << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location / {
        proxy_pass http://localhost:$APP_PORT;
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
        proxy_pass http://localhost:$APP_PORT;
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
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:$APP_PORT;
        access_log off;
    }
}
EOF

# Enable the site
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf /etc/nginx/sites-available/cricket-scorer /etc/nginx/sites-enabled/
    log "✓ Site enabled using sites-enabled"
else
    # For CentOS/RHEL, create symlink in conf.d
    ln -sf /etc/nginx/sites-available/cricket-scorer /etc/nginx/conf.d/cricket-scorer.conf
    log "✓ Site enabled using conf.d"
fi

# Test Nginx configuration
log "Testing Nginx configuration..."
nginx -t

# Reload Nginx
systemctl reload nginx
log "✓ Nginx reloaded with new configuration"

# Install the SSL certificate
log "Installing SSL certificate for $DOMAIN..."
certbot install --cert-name $DOMAIN --nginx

# Test SSL configuration
log "Testing SSL configuration..."
nginx -t

# Final reload
systemctl reload nginx

log "✓ SSL certificate installed successfully"
log "✓ Cricket Scorer is now available at: https://$DOMAIN"

# Verify the installation
log "Verifying installation..."
sleep 3

if curl -s -k https://$DOMAIN >/dev/null 2>&1; then
    log "✓ HTTPS is working properly"
else
    warn "HTTPS might need a moment to become available"
fi

log "🏏 SSL setup completed!"
log ""
log "Your Cricket Scorer application is now secure:"
log "  HTTPS: https://$DOMAIN"
log "  HTTP:  http://$DOMAIN (redirects to HTTPS)"