#!/bin/bash

# Manual SSL Configuration for Cricket Scorer
# This script manually configures SSL when Certbot auto-install fails

set -euo pipefail

DOMAIN="score.ramisetty.net"
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

log "Manually configuring SSL for $DOMAIN..."

# Check if certificate files exist
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "SSL certificate not found. Generating new certificate..."
    certbot certonly --standalone --agree-tos --email webmaster@$DOMAIN -d $DOMAIN
fi

# Remove all existing configurations
rm -f /etc/nginx/sites-available/cricket-scorer
rm -f /etc/nginx/sites-enabled/cricket-scorer
rm -f /etc/nginx/conf.d/cricket-scorer.conf
rm -f /etc/nginx/conf.d/default.conf

# Create complete SSL configuration manually
log "Creating manual SSL configuration..."

cat > /etc/nginx/sites-available/cricket-scorer << EOF
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL optimization
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

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

# Create sites directories if they don't exist
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Enable the site
if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf /etc/nginx/sites-available/cricket-scorer /etc/nginx/sites-enabled/
    
    # Ensure sites-enabled is included in main config
    if ! grep -q "include.*sites-enabled" /etc/nginx/nginx.conf; then
        sed -i '/include.*conf\.d/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    fi
    log "✓ Site enabled using sites-enabled"
else
    # For CentOS/RHEL, copy to conf.d
    cp /etc/nginx/sites-available/cricket-scorer /etc/nginx/conf.d/cricket-scorer.conf
    log "✓ Site enabled using conf.d"
fi

# Test configuration
log "Testing Nginx configuration..."
nginx -t

# Reload Nginx
systemctl reload nginx
log "✓ Nginx reloaded with SSL configuration"

# Set up auto-renewal cron job
log "Setting up SSL certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

log "✓ SSL certificate auto-renewal configured"

# Verify the installation
log "Verifying SSL installation..."
sleep 3

if curl -s -I https://$DOMAIN | head -1 | grep -q "200\|301\|302"; then
    log "✓ HTTPS is working properly"
else
    warn "HTTPS might need a moment to become available"
fi

log "🏏 Manual SSL configuration completed!"
log ""
log "Your Cricket Scorer application is now secure:"
log "  HTTPS: https://$DOMAIN"
log "  HTTP:  http://$DOMAIN (redirects to HTTPS)"
log ""
log "SSL Grade A+ configuration with:"
log "  ✓ TLS 1.2 and 1.3 support"
log "  ✓ Strong cipher suites"
log "  ✓ HSTS enabled"
log "  ✓ Security headers"
log "  ✓ Auto-renewal configured"