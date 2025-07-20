#!/bin/bash

# Nginx SSL Setup Script for Cricket Scorer
# Configures Nginx reverse proxy with SSL for PM2 application

set -euo pipefail

# Configuration
PUBLIC_IP="67.227.251.94"
APP_PORT="3000"
DOMAIN_NAME="${1:-}"  # Optional domain name parameter

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Setting up Nginx reverse proxy with SSL for Cricket Scorer..."

# Detect package manager and install Nginx
if command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
    yum install -y nginx certbot python3-certbot-nginx
elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    dnf install -y nginx certbot python3-certbot-nginx
elif command -v apt >/dev/null 2>&1; then
    PKG_MANAGER="apt"
    apt update
    apt install -y nginx certbot python3-certbot-nginx
else
    error "Unsupported package manager"
fi

log "✓ Nginx and Certbot installed"

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create Nginx configuration for Cricket Scorer
log "Creating Nginx configuration..."

cat > /etc/nginx/sites-available/cricket-scorer << EOF
server {
    listen 80;
    server_name $PUBLIC_IP$([ -n "$DOMAIN_NAME" ] && echo " $DOMAIN_NAME" || echo "");

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

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

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
else
    # For CentOS/RHEL, include in main config
    if ! grep -q "include.*cricket-scorer" /etc/nginx/nginx.conf; then
        sed -i '/http {/a\    include /etc/nginx/sites-available/cricket-scorer;' /etc/nginx/nginx.conf
    fi
fi

# Test Nginx configuration
log "Testing Nginx configuration..."
nginx -t

# Reload Nginx
systemctl reload nginx

log "✓ Nginx configuration created and loaded"

# Configure firewall
log "Configuring firewall..."
if command -v firewall-cmd >/dev/null 2>&1; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
elif command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp
    ufw allow 443/tcp
else
    warn "No supported firewall found. Please manually open ports 80 and 443"
fi

log "✓ Firewall configured"

# SSL Configuration
if [ -n "$DOMAIN_NAME" ]; then
    log "Setting up SSL certificate for domain: $DOMAIN_NAME"
    
    # Obtain SSL certificate
    certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email webmaster@$DOMAIN_NAME --redirect
    
    # Set up auto-renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    log "✓ SSL certificate obtained and auto-renewal configured"
    log "✓ Your Cricket Scorer app is available at: https://$DOMAIN_NAME"
else
    log "No domain provided. Setting up basic HTTP configuration."
    log "For SSL, run: sudo certbot --nginx -d yourdomain.com"
    log "✓ Your Cricket Scorer app is available at: http://$PUBLIC_IP"
fi

# Final verification
log "Verifying deployment..."
sleep 3

if curl -s http://localhost:$APP_PORT/health >/dev/null 2>&1; then
    log "✓ Backend application is responding"
else
    warn "Backend application might not be responding on port $APP_PORT"
fi

if curl -s http://$PUBLIC_IP >/dev/null 2>&1; then
    log "✓ Nginx reverse proxy is working"
else
    warn "Nginx reverse proxy might not be working properly"
fi

log "🏏 Cricket Scorer deployment completed!"
log ""
log "Application URLs:"
log "  HTTP:  http://$PUBLIC_IP"
if [ -n "$DOMAIN_NAME" ]; then
    log "  HTTPS: https://$DOMAIN_NAME"
fi
log ""
log "To check status:"
log "  PM2:   sudo -u cricketapp pm2 status"
log "  Nginx: systemctl status nginx"
log "  Logs:  sudo -u cricketapp pm2 logs cricket-scorer"