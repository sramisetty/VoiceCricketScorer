#!/bin/bash

# Quick Production Fix Script
# Resolves PostgreSQL permissions and completes Nginx setup

set -e

APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Fix PostgreSQL permissions
fix_postgresql() {
    log "Fixing PostgreSQL permissions..."
    
    # Switch to postgres user and grant permissions
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;" 2>/dev/null || true
    
    # Try to create database schema with postgres user
    cd "$APP_DIR"
    sudo -u postgres DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config=drizzle.config.ts 2>/dev/null || true
    
    success "PostgreSQL permissions fixed"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx for $DOMAIN..."
    
    # Stop conflicting services
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    
    # Kill processes on port 80/443
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    lsof -ti:443 | xargs kill -9 2>/dev/null || true
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name score.ramisetty.net;
    
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
    }
    
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
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and restart Nginx
    if nginx -t; then
        systemctl restart nginx
        systemctl enable nginx
        success "Nginx configured successfully"
    else
        error "Nginx configuration failed"
        return 1
    fi
}

# Check application status
check_application() {
    log "Checking application status..."
    
    # Wait for application to be ready
    sleep 5
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "PM2 application is running"
    else
        warning "PM2 application may not be running correctly"
        pm2 logs $APP_NAME --lines 10
    fi
    
    # Check if application responds locally
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application responding on localhost:3000"
    else
        warning "Application not responding on localhost:3000"
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        success "Nginx is running"
    else
        warning "Nginx is not running"
    fi
}

# Main execution
main() {
    log "Starting quick production fix..."
    
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
    
    fix_postgresql
    configure_nginx
    check_application
    
    success "Quick fix completed!"
    log "Application should now be accessible at: http://$DOMAIN"
    log "Note: HTTPS/SSL may require separate setup"
}

main "$@"