#!/bin/bash

# Nginx Port Conflict Fix Script
# Resolves "Address already in use" errors on ports 80 and 443

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
    exit 1
fi

log "Nginx Port Conflict Fix Starting..."

# Stop nginx first
log "Stopping nginx service..."
systemctl stop nginx 2>/dev/null || true

# Stop and disable conflicting web servers
log "Stopping conflicting web servers..."
for service in apache2 httpd lighttpd; do
    if systemctl is-enabled $service 2>/dev/null | grep -q enabled; then
        log "Stopping and disabling $service..."
        systemctl stop $service 2>/dev/null || true
        systemctl disable $service 2>/dev/null || true
    fi
done

# Function to kill processes on a specific port
kill_port_processes() {
    local port=$1
    local processes=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$processes" ]; then
        log "Found processes using port $port: $processes"
        
        # First try graceful termination
        echo "$processes" | xargs kill -TERM 2>/dev/null || true
        sleep 3
        
        # Check if processes are still running
        local remaining=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$remaining" ]; then
            warning "Some processes still running on port $port, force killing..."
            echo "$remaining" | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
        
        # Final check
        if lsof -ti:$port >/dev/null 2>&1; then
            error "Failed to free port $port"
            log "Processes still using port $port:"
            lsof -i:$port
            return 1
        else
            success "Port $port is now free"
        fi
    else
        success "Port $port is already free"
    fi
}

# Kill processes on ports 80 and 443
log "Freeing ports 80 and 443..."
kill_port_processes 80
kill_port_processes 443

# Additional cleanup using fuser if available
if command -v fuser >/dev/null 2>&1; then
    log "Additional cleanup with fuser..."
    fuser -k 80/tcp 2>/dev/null || true
    fuser -k 443/tcp 2>/dev/null || true
    sleep 2
fi

# Verify ports are completely free
log "Verifying ports are free..."
for port in 80 443; do
    if lsof -ti:$port >/dev/null 2>&1; then
        error "Port $port is still in use after cleanup"
        log "Processes using port $port:"
        lsof -i:$port
        exit 1
    fi
done

success "Ports 80 and 443 are completely free"

# Test nginx configuration
log "Testing nginx configuration..."
if nginx -t 2>/dev/null; then
    success "Nginx configuration is valid"
else
    warning "Nginx configuration test failed, checking config..."
    nginx -t
    
    # Try to fix common config issues
    log "Attempting to fix common nginx configuration issues..."
    
    # Check if default site is properly configured
    if [ ! -f /etc/nginx/sites-available/default ]; then
        log "Creating basic default nginx configuration..."
        cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files $uri $uri/ =404;
    }
}
EOF
    fi
    
    # Enable default site
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # Test configuration again
    if nginx -t 2>/dev/null; then
        success "Nginx configuration fixed"
    else
        error "Unable to fix nginx configuration"
        nginx -t
        exit 1
    fi
fi

# Start nginx service
log "Starting nginx service..."
systemctl start nginx

# Enable nginx to start on boot
systemctl enable nginx

# Wait for service to start
sleep 3

# Verify nginx is running
if systemctl is-active --quiet nginx; then
    success "Nginx service is now running"
    
    # Show nginx status
    log "Nginx status:"
    systemctl status nginx --no-pager -l
    
    # Test HTTP response
    log "Testing HTTP response..."
    if curl -f -s http://localhost/ >/dev/null 2>&1; then
        success "HTTP test passed - nginx is responding"
    else
        warning "HTTP test failed - nginx may need additional configuration"
    fi
    
    # Show listening ports
    log "Nginx is listening on:"
    ss -tlnp | grep nginx || netstat -tlnp | grep nginx
    
else
    error "Nginx service failed to start"
    log "Nginx status:"
    systemctl status nginx --no-pager -l
    log "Nginx error log:"
    tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
    exit 1
fi

success "Nginx port conflict fix completed successfully!"
log "Nginx is now running and ports 80/443 are available"
log "You can now configure your application reverse proxy"