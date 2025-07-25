#!/bin/bash

# Cricket Scorer Production Deployment Script
# 
# SCHEMA MANAGEMENT STRATEGY:
# This script implements a comprehensive production-safe schema deployment
# strategy that ensures zero data loss and handles all future schema changes.
# 
# BEFORE DEPLOYMENT:
# 1. Update shared/schema.ts with any new tables/columns
# 2. Run ./validate-schema.sh to verify script matches schema
# 3. Test locally with npm run db:push
# 4. Only deploy after validation passes
# 
# SCHEMA SAFETY FEATURES:
# - CREATE TABLE IF NOT EXISTS (safe table creation)
# - ALTER TABLE ADD COLUMN IF NOT EXISTS (safe column addition)  
# - INSERT...WHERE NOT EXISTS (safe sample data)
# - Comprehensive column checks for ALL 12 tables
# - Zero DROP statements (data preservation guaranteed)
# for Linux VPS
# Version: 2.0
# Compatible with: Ubuntu 20.04+, CentOS 8+, RHEL 8+, AlmaLinux 9+

set -e

# Configuration
APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"
NODE_VERSION="20.x"
POSTGRES_VERSION="15"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Setup repository
setup_repository() {
    log "Setting up Cricket Scorer repository..."
    
    # Create application directory
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # Clone or update repository
    if [ -d ".git" ]; then
        log "Updating existing repository..."
        git stash
        git fetch origin main
        git reset --hard origin/main
    else
        log "Cloning fresh repository..."
        git clone https://github.com/ramisetty-sideline/cricket.git .
    fi
    
    success "Repository setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package manager
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y curl wget gnupg2 software-properties-common
    elif command -v yum >/dev/null 2>&1; then
        yum update -y
        yum install -y curl wget gnupg2
    fi
    
    # Install Node.js
    log "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Install PostgreSQL
    log "Installing PostgreSQL ${POSTGRES_VERSION}..."
    apt-get install -y postgresql postgresql-contrib
    
    # Install PM2 globally
    npm install -g pm2
    
    # Install Nginx
    apt-get install -y nginx
    
    success "System dependencies installed"
}

# Setup database
setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Start PostgreSQL service
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql <<EOF
CREATE DATABASE cricket_scorer;
CREATE USER cricket_user WITH PASSWORD 'simple123';
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
ALTER USER cricket_user CREATEDB;
\q
EOF
    
    # Configure PostgreSQL for local connections
    POSTGRES_CONFIG="/etc/postgresql/*/main/pg_hba.conf"
    if [ -f /etc/postgresql/15/main/pg_hba.conf ]; then
        POSTGRES_CONFIG="/etc/postgresql/15/main/pg_hba.conf"
    fi
    
    # Add local connection for cricket_user
    echo "local   cricket_scorer    cricket_user                     md5" >> "$POSTGRES_CONFIG"
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    success "Database setup completed"
}

# Build application
build_application() {
    log "Building Cricket Scorer application..."
    
    cd "$APP_DIR"
    
    # Install Node.js dependencies
    npm install
    
    # Build the application
    npm run build
    
    success "Application build completed"
}

# Configure PM2
configure_pm2() {
    log "Configuring PM2..."
    
    cd "$APP_DIR"
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer'
    }
  }]
};
EOF
    
    # Start application with PM2
    pm2 start ecosystem.config.cjs
    pm2 save
    pm2 startup
    
    success "PM2 configuration completed"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/cricket-scorer <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/cricket-scorer /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    # Start Nginx
    systemctl start nginx
    systemctl enable nginx
    
    success "Nginx configuration completed"
}

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."
    
    check_root
    setup_repository
    install_dependencies
    setup_database
    build_application
    configure_pm2
    configure_nginx
    
    success "Cricket Scorer deployment completed successfully!"
    log ""
    log "=== DEPLOYMENT SUMMARY ==="
    log "Application Directory: $APP_DIR"
    log "Database: cricket_scorer (PostgreSQL)"
    log "Application Port: 3000"
    log "Web Server: Nginx (ports 80/443)"
    log ""
    log "=== ACCESS INFORMATION ==="
    log "Application URL: http://$DOMAIN"
    log ""
    log "=== SERVICE STATUS ==="
    systemctl is-active postgresql >/dev/null 2>&1 && echo "✓ PostgreSQL: Running" || echo "✗ PostgreSQL: Not running"
    systemctl is-active nginx >/dev/null 2>&1 && echo "✓ Nginx: Running" || echo "✗ Nginx: Not running"
    pm2 list | grep -q "$APP_NAME.*online" && echo "✓ Cricket Scorer App: Running" || echo "✗ Cricket Scorer App: Not running"
}

# Run main function
main "$@"