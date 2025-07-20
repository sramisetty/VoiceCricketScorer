#!/bin/bash

# Production SSL Setup for Cricket Scorer
# Complete setup including Nginx installation and SSL configuration

set -euo pipefail

DOMAIN="score.ramisetty.net"
APP_PORT="3000"

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

log "Setting up production SSL for Cricket Scorer..."

# Detect OS and install Nginx + Certbot
if command -v yum >/dev/null 2>&1; then
    yum install -y nginx certbot python3-certbot-nginx
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx certbot python3-certbot-nginx
elif command -v apt >/dev/null 2>&1; then
    apt update
    apt install -y nginx certbot python3-certbot-nginx
fi

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Create simple HTTP configuration first
cat > /etc/nginx/conf.d/cricket-scorer.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# Test and reload
nginx -t
systemctl reload nginx

log "✓ Basic Nginx configuration loaded"

# Get SSL certificate
log "Obtaining SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN --redirect

log "✓ SSL certificate obtained and installed"

# Configure firewall
if command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
elif command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp
    ufw allow 443/tcp
fi

# Set up auto-renewal
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

log "✓ SSL auto-renewal configured"

# Final test
sleep 3
if curl -s -I https://$DOMAIN | head -1 | grep -q "200\|301\|302"; then
    log "✓ HTTPS is working properly"
fi

log "🏏 Cricket Scorer is now available at: https://$DOMAIN"