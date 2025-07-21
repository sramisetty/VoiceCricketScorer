#!/bin/bash

# Emergency services fix - run this on production to immediately resolve issues
# This script handles both PostgreSQL configuration errors and Nginx port conflicts

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }

echo "=== Emergency Services Fix for Cricket Scorer ==="

# 1. Fix PostgreSQL Configuration
log "Fixing PostgreSQL configuration..."

PG_DATA_DIR="/var/lib/pgsql/data"
PG_CONF="$PG_DATA_DIR/postgresql.conf"

systemctl stop postgresql 2>/dev/null || true

if [ -f "$PG_CONF" ]; then
    cp "$PG_CONF" "$PG_CONF.corrupted.$(date +%Y%m%d_%H%M%S)"
    success "Backed up corrupted PostgreSQL configuration"
fi

cat > "$PG_CONF" << 'EOF'
# PostgreSQL Configuration - Cricket Scorer Emergency Fix
max_connections = 100
port = 5432
shared_buffers = 128MB
effective_cache_size = 4GB
work_mem = 4MB
maintenance_work_mem = 64MB
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
log_rotation_age = 1d
log_rotation_size = 10MB
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.UTF-8'
lc_monetary = 'en_US.UTF-8'
lc_numeric = 'en_US.UTF-8'
lc_time = 'en_US.UTF-8'
dynamic_shared_memory_type = posix
ssl = off
EOF

chown postgres:postgres "$PG_CONF"
chmod 600 "$PG_CONF"
success "Created clean PostgreSQL configuration"

# 2. Fix Nginx Port Conflicts
log "Resolving Nginx port conflicts..."

# Stop all web servers
systemctl stop nginx 2>/dev/null || true
systemctl stop httpd 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
killall nginx 2>/dev/null || true

# Install lsof if needed
if ! command -v lsof &> /dev/null; then
    dnf install -y lsof 2>/dev/null || yum install -y lsof 2>/dev/null || true
fi

# Kill processes on ports 80 and 443
if command -v lsof &> /dev/null; then
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    lsof -ti:443 | xargs kill -9 2>/dev/null || true
fi

fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
pkill -f ":80" 2>/dev/null || true
pkill -f ":443" 2>/dev/null || true

# Alternative cleanup
netstat -tlnp | grep ':80 ' | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9 2>/dev/null || true
netstat -tlnp | grep ':443 ' | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9 2>/dev/null || true

sleep 3

# Remove conflicting Nginx configs
rm -f /etc/nginx/conf.d/cricket-scorer*.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Create simple working Nginx config
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

success "Created clean Nginx configuration"

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
echo "=== Service Status ==="
systemctl is-active postgresql && echo "✓ PostgreSQL: Active" || echo "✗ PostgreSQL: Inactive"
systemctl is-active nginx && echo "✓ Nginx: Active" || echo "✗ Nginx: Inactive"

# Test database
if sudo -u postgres psql -c "SELECT version();" 2>/dev/null; then
    success "PostgreSQL database connection working"
else
    error "PostgreSQL database connection failed"
fi

# Test web server
if curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null | grep -q "200\|301\|302\|502"; then
    success "Nginx web server responding"
else
    error "Nginx web server not responding"
fi

echo "=== Emergency Fix Complete ==="
echo "Services should now be running. Test: https://score.ramisetty.net"