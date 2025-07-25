#!/bin/bash

# Cricket Scorer Production Status Check
# Date: Wed Jul 23 05:12:17 PM EDT 2025

echo "=== Cricket Scorer Production Status Check ==="
echo "Date: $(date)"
echo ""

# Configuration
APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log "Running as root user"
else
    log "Running as non-root user: $(whoami)"
fi

echo ""
echo "=== 1. PM2 Process Status ==="
if command -v pm2 >/dev/null 2>&1; then
    success "PM2 is installed"
    pm2 status
    
    # Check specific cricket-scorer process
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Cricket Scorer application is running"
        
        # Get process details
        pm2 show $APP_NAME 2>/dev/null | head -20
    else
        error "Cricket Scorer application is not running"
        warning "Attempting to check PM2 logs..."
        pm2 logs $APP_NAME --lines 10 2>/dev/null || echo "No PM2 logs available"
    fi
else
    error "PM2 is not installed"
fi

echo ""
echo "=== 2. System Service Status ==="

# PostgreSQL
if systemctl is-active --quiet postgresql; then
    success "PostgreSQL is running"
    systemctl status postgresql --no-pager -l
else
    error "PostgreSQL is not running"
    systemctl status postgresql --no-pager -l
fi

echo ""

# Nginx
if systemctl is-active --quiet nginx; then
    success "Nginx is running"
    systemctl status nginx --no-pager -l
else
    error "Nginx is not running"
    systemctl status nginx --no-pager -l
fi

echo ""
echo "=== 3. Network Connectivity ==="

# Check if application port is listening
if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    success "Application is listening on port 3000"
else
    error "Application is not listening on port 3000"
fi

# Check if nginx is listening
if netstat -tuln 2>/dev/null | grep -q ":80 "; then
    success "Nginx is listening on port 80"
else
    error "Nginx is not listening on port 80"
fi

# Check if nginx SSL is listening
if netstat -tuln 2>/dev/null | grep -q ":443 "; then
    success "Nginx is listening on port 443 (SSL)"
else
    warning "Nginx is not listening on port 443 (SSL may not be configured)"
fi

echo ""
echo "=== 4. Application Connectivity ==="

# Test local application
log "Testing local application (localhost:3000)..."
if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
    success "Local application is responding"
else
    error "Local application is not responding"
    
    # Try health endpoint
    if curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
        success "Application health endpoint is responding"
    else
        error "Application health endpoint is not responding"
    fi
fi

# Test nginx proxy
log "Testing nginx proxy (localhost:80)..."
if curl -f -s -H "Host: $DOMAIN" http://localhost/ >/dev/null 2>&1; then
    success "Nginx proxy is working"
else
    error "Nginx proxy is not working"
fi

# Test external domain (if available)
log "Testing external domain ($DOMAIN)..."
if curl -f -s http://$DOMAIN/ >/dev/null 2>&1; then
    success "External domain is accessible"
else
    warning "External domain may not be accessible (could be DNS/firewall)"
fi

echo ""
echo "=== 5. Database Connectivity ==="

# Test database connection
if command -v psql >/dev/null 2>&1; then
    log "Testing database connection..."
    if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
        success "Database connection successful"
        
        # Check table count
        table_count=$(PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        if [ ! -z "$table_count" ]; then
            success "Database has $table_count tables"
        fi
    else
        error "Database connection failed"
    fi
else
    warning "PostgreSQL client (psql) not available for testing"
fi

echo ""
echo "=== 6. API Endpoints Test ==="

api_base="http://localhost:3000/api"
endpoints=("health" "matches" "franchises" "teams")

for endpoint in "${endpoints[@]}"; do
    log "Testing /api/$endpoint..."
    if curl -f -s "$api_base/$endpoint" >/dev/null 2>&1; then
        success "$endpoint endpoint is working"
    else
        error "$endpoint endpoint is not working"
    fi
done

echo ""
echo "=== 7. File System Check ==="

# Check application directory
if [ -d "$APP_DIR" ]; then
    success "Application directory exists: $APP_DIR"
    
    # Check critical files
    critical_files=("package.json" "dist/index.js" "ecosystem.config.cjs")
    for file in "${critical_files[@]}"; do
        if [ -f "$APP_DIR/$file" ]; then
            success "$file exists"
        else
            error "$file is missing"
        fi
    done
    
    # Check directory permissions
    if [ -r "$APP_DIR" ] && [ -w "$APP_DIR" ]; then
        success "Application directory has proper permissions"
    else
        warning "Application directory permissions may be incorrect"
    fi
else
    error "Application directory does not exist: $APP_DIR"
fi

echo ""
echo "=== 8. Resource Usage ==="

# Memory usage
log "Memory usage:"
free -h

echo ""

# Disk usage
log "Disk usage:"
df -h

echo ""

# Load average
log "System load:"
uptime

echo ""
echo "=== 9. Recent Logs ==="

# PM2 logs
if command -v pm2 >/dev/null 2>&1; then
    log "Recent PM2 logs (last 10 lines):"
    pm2 logs $APP_NAME --lines 10 2>/dev/null || echo "No PM2 logs available"
fi

echo ""

# Nginx error logs
if [ -f "/var/log/nginx/error.log" ]; then
    log "Recent Nginx error logs (last 5 lines):"
    tail -5 /var/log/nginx/error.log 2>/dev/null || echo "No nginx error logs"
fi

echo ""

# System journal for our services
log "Recent systemd journal entries:"
journalctl -u nginx -u postgresql --lines 5 --no-pager 2>/dev/null || echo "No journal entries available"

echo ""
echo "=== Production Status Summary ==="

# Overall health assessment
health_score=0
total_checks=8

# PM2 check
if pm2 list 2>/dev/null | grep -q "$APP_NAME.*online"; then
    ((health_score++))
fi

# PostgreSQL check
if systemctl is-active --quiet postgresql; then
    ((health_score++))
fi

# Nginx check
if systemctl is-active --quiet nginx; then
    ((health_score++))
fi

# Port 3000 check
if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    ((health_score++))
fi

# Local app check
if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
    ((health_score++))
fi

# Nginx proxy check
if curl -f -s -H "Host: $DOMAIN" http://localhost/ >/dev/null 2>&1; then
    ((health_score++))
fi

# Database check
if command -v psql >/dev/null 2>&1 && PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    ((health_score++))
fi

# File system check
if [ -d "$APP_DIR" ] && [ -f "$APP_DIR/dist/index.js" ]; then
    ((health_score++))
fi

# Calculate percentage
health_percentage=$((health_score * 100 / total_checks))

echo "Health Score: $health_score/$total_checks ($health_percentage%)"

if [ $health_percentage -ge 90 ]; then
    success "System is running optimally"
elif [ $health_percentage -ge 70 ]; then
    warning "System is running with minor issues"
elif [ $health_percentage -ge 50 ]; then
    warning "System has significant issues that need attention"
else
    error "System is experiencing critical issues"
fi

echo ""
echo "=== Recommended Actions ==="

if [ $health_score -lt $total_checks ]; then
    echo "Based on the status check, consider the following actions:"
    
    if ! pm2 list 2>/dev/null | grep -q "$APP_NAME.*online"; then
        echo "• Restart the Cricket Scorer application: pm2 restart $APP_NAME"
    fi
    
    if ! systemctl is-active --quiet postgresql; then
        echo "• Start PostgreSQL service: systemctl start postgresql"
    fi
    
    if ! systemctl is-active --quiet nginx; then
        echo "• Start Nginx service: systemctl start nginx"
    fi
    
    if ! curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        echo "• Check application logs: pm2 logs $APP_NAME"
        echo "• Verify application build: ls -la $APP_DIR/dist/"
    fi
    
    if ! curl -f -s -H "Host: $DOMAIN" http://localhost/ >/dev/null 2>&1; then
        echo "• Check Nginx configuration: nginx -t"
        echo "• Review Nginx error logs: tail -20 /var/log/nginx/error.log"
    fi
else
    success "All systems are operational!"
fi

echo ""
echo "=== Status Check Complete ==="
echo "Timestamp: $(date)"