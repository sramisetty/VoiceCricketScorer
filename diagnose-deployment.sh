#!/bin/bash

# Diagnose Cricket Scorer Deployment
# Check why https://score.ramisetty.net is not accessible

set -e

APP_NAME="cricket-scorer"
DOMAIN="score.ramisetty.net"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Check PM2 status and logs
check_pm2() {
    log "Checking PM2 status..."
    pm2 status
    
    log "Recent PM2 logs for cricket-scorer:"
    pm2 logs cricket-scorer --lines 20 --nostream
}

# Check application ports
check_ports() {
    log "Checking port usage..."
    
    log "Port 3000 (Application):"
    lsof -i :3000 || echo "No process on port 3000"
    
    log "Port 80 (HTTP):"
    lsof -i :80 || echo "No process on port 80"
    
    log "Port 443 (HTTPS):"
    lsof -i :443 || echo "No process on port 443"
}

# Test local connectivity
test_local() {
    log "Testing local connectivity..."
    
    # Test application directly
    log "Testing http://localhost:3000/"
    if curl -I http://localhost:3000/ 2>&1; then
        success "Application responds on localhost:3000"
    else
        error "Application not responding on localhost:3000"
    fi
    
    # Test Nginx
    log "Testing Nginx configuration..."
    nginx -t
    
    log "Testing http://localhost:80/"
    if curl -I http://localhost/ 2>&1; then
        success "Nginx responds on localhost:80"
    else
        error "Nginx not responding on localhost:80"
    fi
}

# Check Nginx configuration
check_nginx() {
    log "Checking Nginx configuration..."
    
    log "Active Nginx sites:"
    ls -la /etc/nginx/sites-enabled/
    
    log "Cricket Scorer Nginx config:"
    cat /etc/nginx/sites-available/cricket-scorer 2>/dev/null || echo "Config file not found"
    
    log "Nginx service status:"
    systemctl status nginx --no-pager -l
}

# Check DNS and external connectivity
check_external() {
    log "Checking external connectivity..."
    
    log "DNS resolution for $DOMAIN:"
    nslookup $DOMAIN || echo "DNS lookup failed"
    
    log "Testing external HTTP access:"
    curl -I http://$DOMAIN/ --connect-timeout 5 2>&1 || echo "External HTTP access failed"
    
    log "Testing external HTTPS access:"
    curl -I https://$DOMAIN/ --connect-timeout 5 2>&1 || echo "External HTTPS access failed"
}

# Check firewall
check_firewall() {
    log "Checking firewall status..."
    
    if command -v ufw >/dev/null 2>&1; then
        ufw status
    elif command -v firewall-cmd >/dev/null 2>&1; then
        firewall-cmd --list-all
    else
        warning "No firewall tool found"
    fi
}

# Main diagnostic
main() {
    log "Starting Cricket Scorer deployment diagnosis..."
    
    check_pm2
    echo "----------------------------------------"
    check_ports
    echo "----------------------------------------"
    test_local
    echo "----------------------------------------"
    check_nginx
    echo "----------------------------------------"
    check_external
    echo "----------------------------------------"
    check_firewall
    
    log "Diagnosis complete!"
}

main "$@"