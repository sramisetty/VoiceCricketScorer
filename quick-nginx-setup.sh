#!/bin/bash

# Quick Nginx Setup for Cricket Scorer
# Simple HTTP setup for immediate access

set -euo pipefail

PUBLIC_IP="67.227.251.94"
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

log "Quick Nginx setup for Cricket Scorer..."

# Install Nginx
if command -v yum >/dev/null 2>&1; then
    yum install -y nginx
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
elif command -v apt >/dev/null 2>&1; then
    apt update && apt install -y nginx
fi

# Simple Nginx config
cat > /etc/nginx/conf.d/cricket-scorer.conf << EOF
server {
    listen 80;
    server_name $PUBLIC_IP;

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

# Start Nginx
systemctl start nginx
systemctl enable nginx

# Configure firewall
if command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
elif command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp
fi

systemctl reload nginx

log "✓ Nginx configured and running"
log "✓ Cricket Scorer available at: http://$PUBLIC_IP"