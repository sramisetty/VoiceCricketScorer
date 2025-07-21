#!/bin/bash

# Cricket Scorer Production Deployment Script for AlmaLinux 9
# Fixed version - Uses existing /opt/cricket-scorer directory

set -e  # Exit on any error

# Configuration
APP_DIR="/opt/cricket-scorer"
APP_NAME="cricket-scorer"
DOMAIN="score.ramisetty.net"
BACKUP_DIR="/opt/cricket-scorer/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Log functions
log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${CYAN}ℹ $1${NC}"; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Main deployment steps
main() {
    echo "================================================="
    echo "   Cricket Scorer Production Deployment (Fixed)"
    echo "   Using existing setup at: $APP_DIR"
    echo "================================================="
    echo ""
    
    check_root
    
    log "Starting deployment from existing directory..."
    
    if [ ! -d "$APP_DIR" ]; then
        error "Directory $APP_DIR not found!"
        exit 1
    fi
    
    cd "$APP_DIR"
    
    # Install dependencies using npm install (not npm ci)
    log "Installing dependencies with npm install..."
    rm -rf node_modules 2>/dev/null || true
    npm install --production=false
    success "Dependencies installed"
    
    # Build application
    log "Building application..."
    rm -rf dist/ server/public/ 2>/dev/null || true
    mkdir -p server/public dist logs
    
    # Build frontend
    NODE_ENV=production npm run build
    success "Application built"
    
    # Setup PM2
    log "Configuring PM2..."
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    pm2 save
    success "PM2 configured"
    
    # Test application
    log "Testing application..."
    sleep 5
    if curl -f http://localhost:3000/health 2>/dev/null || curl -f http://localhost:3000 2>/dev/null; then
        success "Application is running"
    else
        warning "Application test failed, but continuing..."
    fi
    
    # Configure Nginx
    log "Configuring Nginx..."
    cat > /etc/nginx/conf.d/cricket-scorer.conf << 'EOF'
server {
    listen 80;
    server_name score.ramisetty.net;
    
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://127.0.0.1:3000;
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
    
    if nginx -t; then
        systemctl reload nginx
        success "Nginx configured"
    else
        error "Nginx configuration failed"
        nginx -t
    fi
    
    echo ""
    echo "================================================="
    echo "   Deployment Completed!"
    echo "================================================="
    echo ""
    echo "Application URL: http://$DOMAIN"
    echo "PM2 Status:"
    pm2 status
    echo ""
    echo "Test the application: curl http://$DOMAIN"
}

# Error handling
trap 'error "Deployment failed at line $LINENO"' ERR

# Run deployment
main "$@"