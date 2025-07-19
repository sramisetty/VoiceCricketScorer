#!/bin/bash

# Cricket Scorer Application Monitoring Script
# This script provides health checks and monitoring capabilities

# Configuration
APP_NAME="cricket-scorer"
SERVICE_NAME="cricket-scorer"
APP_URL="http://localhost:3000"
LOG_DIR="/var/log/cricket-scorer"
ALERT_EMAIL=""  # Set this to receive email alerts

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
else
    PKG_MANAGER="unknown"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Function to check service status
check_service() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "✓ Service $SERVICE_NAME is running"
        return 0
    else
        error "✗ Service $SERVICE_NAME is not running"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http() {
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/health" || echo "000")
    
    if [ "$response_code" = "200" ]; then
        log "✓ HTTP endpoint is responding (200)"
        return 0
    else
        error "✗ HTTP endpoint failed (code: $response_code)"
        return 1
    fi
}

# Function to check database connection
check_database() {
    if sudo -u postgres psql -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
        log "✓ Database connection successful"
        return 0
    else
        error "✗ Database connection failed"
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -lt 90 ]; then
        log "✓ Disk usage: ${usage}%"
        return 0
    else
        warn "⚠ High disk usage: ${usage}%"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    local usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
    local usage_int=$(echo "$usage" | cut -d'.' -f1)
    
    if [ "$usage_int" -lt 90 ]; then
        log "✓ Memory usage: ${usage}%"
        return 0
    else
        warn "⚠ High memory usage: ${usage}%"
        return 1
    fi
}

# Function to check CPU load
check_cpu_load() {
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_count=$(nproc)
    
    # Use awk for floating point arithmetic (bc might not be available)
    local load_normalized=$(awk "BEGIN {printf \"%.2f\", $load / $cpu_count}")
    local load_check=$(awk "BEGIN {print ($load_normalized < 1.0) ? 1 : 0}")
    
    if [ "$load_check" -eq 1 ]; then
        log "✓ CPU load: $load (normalized: $load_normalized)"
        return 0
    else
        warn "⚠ High CPU load: $load (normalized: $load_normalized)"
        return 1
    fi
}

# Function to check log errors
check_logs() {
    local error_count=$(journalctl -u "$SERVICE_NAME" --since "1 hour ago" | grep -i error | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        log "✓ No errors in logs (last hour)"
        return 0
    else
        warn "⚠ Found $error_count errors in logs (last hour)"
        return 1
    fi
}

# Function to display system status
show_system_status() {
    echo ""
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}                    CRICKET SCORER SYSTEM STATUS${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
    echo ""
    
    # Service information
    echo -e "${YELLOW}Service Information:${NC}"
    systemctl status "$SERVICE_NAME" --no-pager | head -10
    echo ""
    
    # System resources
    echo -e "${YELLOW}System Resources:${NC}"
    echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')%"
    echo "Memory Usage: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
    echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    echo ""
    
    # Network connections
    echo -e "${YELLOW}Network Connections:${NC}"
    netstat -tulpn | grep ":3000\|:80\|:443" | head -5
    echo ""
    
    # Recent logs
    echo -e "${YELLOW}Recent Logs (last 10 lines):${NC}"
    journalctl -u "$SERVICE_NAME" --no-pager -n 10
    echo ""
}

# Function to run health check
health_check() {
    log "Running health check for Cricket Scorer..."
    
    local failed_checks=0
    
    check_service || ((failed_checks++))
    check_http || ((failed_checks++))
    check_database || ((failed_checks++))
    check_disk_space || ((failed_checks++))
    check_memory || ((failed_checks++))
    check_cpu_load || ((failed_checks++))
    check_logs || ((failed_checks++))
    
    echo ""
    if [ "$failed_checks" -eq 0 ]; then
        log "✓ All health checks passed!"
        return 0
    else
        error "✗ $failed_checks health check(s) failed"
        return 1
    fi
}

# Function to restart application
restart_app() {
    log "Restarting Cricket Scorer application..."
    
    systemctl restart "$SERVICE_NAME"
    sleep 5
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "✓ Application restarted successfully"
    else
        error "✗ Failed to restart application"
        exit 1
    fi
}

# Function to show recent logs
show_logs() {
    local lines=${1:-50}
    echo -e "${YELLOW}Recent application logs (last $lines lines):${NC}"
    journalctl -u "$SERVICE_NAME" --no-pager -n "$lines"
}

# Function to follow logs
follow_logs() {
    echo -e "${YELLOW}Following application logs (press Ctrl+C to stop):${NC}"
    journalctl -u "$SERVICE_NAME" -f
}

# Function to show performance metrics
show_performance() {
    echo ""
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}                    CRICKET SCORER PERFORMANCE METRICS${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
    echo ""
    
    # Process information
    echo -e "${YELLOW}Process Information:${NC}"
    ps aux | grep node | grep -v grep | head -5
    echo ""
    
    # Memory details
    echo -e "${YELLOW}Memory Details:${NC}"
    free -h
    echo ""
    
    # Disk I/O
    echo -e "${YELLOW}Disk I/O:${NC}"
    if command -v iostat &> /dev/null; then
        iostat -x 1 1 2>/dev/null
    else
        echo "iostat not available. Install sysstat package:"
        if [ "$PKG_MANAGER" = "apt" ]; then
            echo "  sudo apt-get install sysstat"
        elif [ "$PKG_MANAGER" = "yum" ]; then
            echo "  sudo yum install sysstat"
        elif [ "$PKG_MANAGER" = "dnf" ]; then
            echo "  sudo dnf install sysstat"
        fi
    fi
    echo ""
    
    # Network statistics
    echo -e "${YELLOW}Network Statistics:${NC}"
    cat /proc/net/dev | head -5
    echo ""
}

# Function to create monitoring cron job
setup_monitoring() {
    log "Setting up monitoring cron job..."
    
    # Create monitoring cron job (every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * $0 health > /var/log/cricket-scorer-health.log 2>&1") | crontab -
    
    log "✓ Monitoring cron job created (runs every 5 minutes)"
}

# Main function
case "$1" in
    "health")
        health_check
        ;;
    "status")
        show_system_status
        ;;
    "restart")
        restart_app
        ;;
    "logs")
        show_logs "$2"
        ;;
    "follow")
        follow_logs
        ;;
    "performance")
        show_performance
        ;;
    "setup-monitoring")
        setup_monitoring
        ;;
    *)
        echo "Cricket Scorer Monitoring Script"
        echo ""
        echo "Usage: $0 {health|status|restart|logs|follow|performance|setup-monitoring}"
        echo ""
        echo "Commands:"
        echo "  health              - Run health checks"
        echo "  status              - Show system status"
        echo "  restart             - Restart the application"
        echo "  logs [lines]        - Show recent logs (default: 50 lines)"
        echo "  follow              - Follow logs in real-time"
        echo "  performance         - Show performance metrics"
        echo "  setup-monitoring    - Setup automated monitoring"
        echo ""
        exit 1
        ;;
esac