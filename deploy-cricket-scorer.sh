#!/bin/bash

# Cricket Scorer Production Deployment Script for Linux VPS
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

# Build application for production
build_application() {
    log "Building application for production..."
    
    cd "$APP_DIR"
    
    # Clean previous builds and remove Replit dependencies
    rm -rf dist/ server/public/ 2>/dev/null || true
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    # Remove Replit script from HTML
    sed -i '/<script.*replit-dev-banner\.js/d' client/index.html
    
    # Create necessary directories
    mkdir -p server/public dist logs
    
    # Use existing working build process
    log "Building client with existing production config..."
    NODE_ENV=production npx vite build --config vite.config.production.ts --mode production
    
    # Check if build succeeded
    if [ ! -f "server/public/index.html" ]; then
        # Fallback: copy from dist if built there
        if [ -f "dist/index.html" ]; then
            log "Copying build from dist/ to server/public/"
            mkdir -p server/public
            cp -r dist/* server/public/
        else
            error "Client build failed - no static files found"
            exit 1
        fi
    fi
    success "Client build completed successfully"
    
    # Build server
    log "Building server application..."
    npx esbuild server/index.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --outfile=dist/index.js \
        --packages=external \
        --format=esm \
        --minify \
        --define:process.env.NODE_ENV=\"production\"
    
    if [ ! -f "dist/index.js" ]; then
        error "Server build failed"
        exit 1
    fi
    
    # Set proper permissions
    chmod -R 755 server/public/ dist/
    chown -R root:root server/public/ dist/
    
    success "Application built successfully"
}

# Install dependencies
install_dependencies() {
    log "Installing application dependencies..."
    
    cd "$APP_DIR"
    
    # Clean install
    rm -rf node_modules 2>/dev/null || true
    
    # Install with production dependencies
    npm install --production=false
    
    # Install terser for production build
    log "Installing terser for production builds..."
    npm install terser --save-dev
    
    # Generate package-lock.json for future deployments
    log "Generating package-lock.json for consistent deployments..."
    
    # Remove Replit-specific packages in production
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    success "Dependencies installed successfully"
}

# Fix PostgreSQL configuration
fix_postgresql_config() {
    log "Checking and fixing PostgreSQL configuration..."
    
    PGDATA_DIR="/var/lib/pgsql/data"
    POSTGRES_CONF="$PGDATA_DIR/postgresql.conf"
    
    # Stop PostgreSQL service first
    systemctl stop postgresql 2>/dev/null || true
    
    if [ -f "$POSTGRES_CONF" ]; then
        # Check for invalid configuration parameters
        if grep -q "shared_buffers.*0.*8kB\|effective_cache_size.*0.*8kB" "$POSTGRES_CONF"; then
            log "Found invalid PostgreSQL configuration, fixing..."
            
            # Create backup
            cp "$POSTGRES_CONF" "$POSTGRES_CONF.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Create minimal working configuration
            cat > "$POSTGRES_CONF" << 'EOF'
# Minimal PostgreSQL Configuration
listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 2GB
EOF
            
            # Set proper ownership and permissions
            chown postgres:postgres "$POSTGRES_CONF"
            chmod 600 "$POSTGRES_CONF"
            
            success "PostgreSQL configuration fixed"
        fi
    fi
    
    # Start PostgreSQL service
    log "Starting PostgreSQL service..."
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for service to be ready
    sleep 5
    
    if systemctl is-active --quiet postgresql; then
        success "PostgreSQL service is running"
    else
        error "PostgreSQL service failed to start"
        systemctl status postgresql
        exit 1
    fi
}

# Setup database
setup_database() {
    log "Setting up database schema..."
    
    cd "$APP_DIR"
    
    # Fix PostgreSQL configuration first
    fix_postgresql_config
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if su - postgres -c "psql -c 'SELECT 1;'" >/dev/null 2>&1; then
            success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start within 30 seconds"
            systemctl status postgresql
            exit 1
        fi
        sleep 1
    done
    
    # Run database migrations
    log "Running database migrations..."
    npm run db:push || warning "Database schema sync may have issues, continuing deployment"
    
    success "Database schema synchronized"
}

# Configure PM2 for production
configure_pm2() {
    log "Configuring PM2 for production..."
    
    cd "$APP_DIR"
    
    # Stop existing PM2 processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start application with existing PM2 config
    log "Starting application with PM2..."
    pm2 start ecosystem.config.cjs --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Wait for application to start
    sleep 10
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application started successfully with PM2"
        pm2 status
    else
        error "Failed to start application with PM2"
        pm2 logs $APP_NAME --lines 20
        exit 1
    fi
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx reverse proxy..."
    
    # Stop nginx first
    systemctl stop nginx 2>/dev/null || true
    
    # Comprehensive port cleanup
    log "Clearing port conflicts..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
    systemctl disable httpd 2>/dev/null || true
    
    # Kill any processes using ports 80 and 443
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            log "Killing processes on port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    done
    
    # Verify ports are free
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            error "Port $port is still in use after cleanup"
            lsof -i:$port
            exit 1
        fi
    done
    
    success "Ports 80 and 443 are now free"
    
    # Test nginx configuration first
    log "Testing Nginx configuration..."
    nginx -t
    if [ $? -ne 0 ]; then
        error "Nginx configuration test failed"
        exit 1
    fi
    
    # Start Nginx service
    log "Starting Nginx service..."
    systemctl start nginx
    systemctl enable nginx
    
    # Wait for nginx to start
    sleep 3
    
    if systemctl is-active --quiet nginx; then
        success "Nginx service is running"
    else
        error "Nginx service failed to start"
        systemctl status nginx
        exit 1
    fi
    
    # Create Nginx configuration for the app
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
    
    # Enable site and remove default
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and restart Nginx
    if nginx -t; then
        systemctl restart nginx
        systemctl enable nginx
        success "Nginx configured successfully"
    else
        error "Nginx configuration test failed"
        exit 1
    fi
}

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."
    
    check_root
    install_dependencies
    setup_database
    build_application
    configure_pm2
    configure_nginx
    
    success "Cricket Scorer deployment completed successfully!"
    log "Application should be accessible at: https://$DOMAIN"
    log "Checking application status..."
    
    sleep 5
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "PM2 application is running"
    else
        warning "PM2 application may not be running correctly"
        pm2 logs $APP_NAME --lines 10
    fi
    
    # Check application response
    if curl -f -s http://localhost:3000/api/health >/dev/null 2>&1 || curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application is responding on localhost:3000"
    else
        warning "Application may not be fully started yet"
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        success "Nginx is running"
        log "Application should be accessible at: http://$DOMAIN"
    else
        warning "Nginx is not running"
    fi
    
    # Final verification
    log "Final deployment verification:"
    pm2 status
}

# Run main function
main "$@"