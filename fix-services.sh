#!/bin/bash

# Emergency fix script for PostgreSQL and Nginx service failures
# Run this on production server to immediately resolve current issues

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }

echo "=== Cricket Scorer Services Emergency Fix ==="
echo "Fixing PostgreSQL configuration and Nginx port conflicts..."

# 1. Fix PostgreSQL Configuration
log "Fixing PostgreSQL configuration..."

PG_DATA_DIR="/var/lib/pgsql/data"
if [ -f "$PG_DATA_DIR/postgresql.conf" ]; then
    # Backup current config
    cp "$PG_DATA_DIR/postgresql.conf" "$PG_DATA_DIR/postgresql.conf.broken.$(date +%Y%m%d_%H%M%S)"
    
    # Create minimal working configuration
    cat > "$PG_DATA_DIR/postgresql.conf" << 'EOF'
# Minimal PostgreSQL Configuration for Cricket Scorer
max_connections = 100
shared_buffers = 128MB
effective_cache_size = 4GB
work_mem = 4MB
dynamic_shared_memory_type = posix
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
datestyle = 'iso, mdy'
timezone = 'UTC'
EOF

    # Set proper permissions
    chown postgres:postgres "$PG_DATA_DIR/postgresql.conf"
    chmod 600 "$PG_DATA_DIR/postgresql.conf"
    
    success "PostgreSQL configuration fixed"
    
    # Test configuration
    log "Testing PostgreSQL configuration..."
    if sudo -u postgres /usr/bin/postgres --config-file="$PG_DATA_DIR/postgresql.conf" -C shared_buffers 2>/dev/null; then
        success "PostgreSQL configuration is valid"
    else
        error "PostgreSQL configuration still has issues"
    fi
else
    error "PostgreSQL configuration file not found at $PG_DATA_DIR/postgresql.conf"
fi

# 2. Fix Nginx Port Conflicts
log "Fixing Nginx port conflicts..."

# Stop all services that might be using ports 80 and 443
systemctl stop nginx 2>/dev/null || true
systemctl stop httpd 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true

# Kill any processes using ports 80 and 443
log "Killing processes using ports 80 and 443..."
lsof -ti:80 | xargs kill -9 2>/dev/null || true
lsof -ti:443 | xargs kill -9 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true

# Wait for ports to be released
sleep 3

# Check if ports are free
log "Checking port availability..."
if netstat -tlnp | grep -E ':80|:443' | grep -v nginx; then
    error "Ports still in use by other processes:"
    netstat -tlnp | grep -E ':80|:443'
    log "Attempting to kill remaining processes..."
    pkill -f ":80"
    pkill -f ":443"
    sleep 2
fi

# Remove conflicting nginx configurations
log "Cleaning Nginx configurations..."
rm -f /etc/nginx/conf.d/cricket-scorer*.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Create simple working nginx configuration
cat > /etc/nginx/conf.d/cricket-scorer.conf << 'EOF'
server {
    listen 80;
    server_name score.ramisetty.net;
    
    # Basic security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # Proxy to Node.js application
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
    
    # WebSocket support
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

# 3. Start Services
log "Starting PostgreSQL..."
if systemctl start postgresql; then
    success "PostgreSQL started successfully"
    systemctl enable postgresql
else
    error "PostgreSQL failed to start"
    systemctl status postgresql --no-pager -l
fi

log "Testing Nginx configuration..."
if nginx -t; then
    success "Nginx configuration is valid"
    
    log "Starting Nginx..."
    if systemctl start nginx; then
        success "Nginx started successfully"
        systemctl enable nginx
    else
        error "Nginx failed to start"
        systemctl status nginx --no-pager -l
    fi
else
    error "Nginx configuration test failed"
    nginx -t
fi

# 4. Test Services
log "Testing service status..."
echo "=== Service Status ==="
systemctl is-active postgresql && echo "✓ PostgreSQL: Active" || echo "✗ PostgreSQL: Inactive"
systemctl is-active nginx && echo "✓ Nginx: Active" || echo "✗ Nginx: Inactive"

# 5. Test database connection
log "Testing database connection..."
if sudo -u postgres psql -c "SELECT version();" 2>/dev/null; then
    success "PostgreSQL database connection working"
else
    error "PostgreSQL database connection failed"
fi

# 6. Test web server
log "Testing web server..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null | grep -q "200\|301\|302"; then
    success "Nginx web server responding"
else
    error "Nginx web server not responding"
fi

echo "=== Fix Complete ==="
echo "Services should now be running. Check https://score.ramisetty.net"