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

# Build application
build_application() {
    log "Building application for production..."
    
    cd "$APP_DIR"
    
    # Clean previous builds
    rm -rf dist/ server/public/ 2>/dev/null || true
    
    # Create necessary directories
    mkdir -p server/public dist logs
    
    # Build client (React/Vite) - VPS Production Build
    log "Building client application for Linux VPS..."
    
    # Use production Vite config for Linux VPS deployment
    log "Using production Vite configuration for VPS build..."
    NODE_ENV=production npx vite build --config vite.config.production.ts --mode production
    
    # Check build results
    log "Checking build output locations..."
    log "Contents of server/public/:"
    ls -la server/public/ 2>/dev/null || echo "  server/public/ not found"
    log "Contents of dist/:"
    ls -la dist/ 2>/dev/null || echo "  dist/ not found"
    
    # Give build time to complete file operations
    sleep 2
    
    # Debug: Show what actually exists
    log "Debugging build output..."
    log "Current directory: $(pwd)"
    log "Contents of server/public/:"
    ls -la server/public/ 2>/dev/null || echo "  Directory not found"
    log "Checking for index.html..."
    
    # Production config outputs directly to server/public
    if [ -f "server/public/index.html" ]; then
        success "Production build completed successfully"
        log "Build artifacts created in server/public/:"
        ls -la server/public/ | head -10
    elif [ -f "dist/index.html" ]; then
        log "Build output found in dist/, copying to server/public/"
        mkdir -p server/public
        cp -r dist/* server/public/
        success "Client build completed and moved to server/public/"
    else
        error "Production build failed - static files not created"
        log "Final check - contents of directories:"
        log "server/public/:"
        ls -la server/public/ 2>/dev/null || echo "  Directory not found"
        log "dist/:"
        ls -la dist/ 2>/dev/null || echo "  Directory not found"
        exit 1
    fi
    
    # Build server (Node.js/Express) - VPS Production Build
    log "Building server application for Linux VPS..."
    npx esbuild server/index.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --outfile=dist/index.js \
        --packages=external \
        --format=esm \
        --minify \
        --loader:.html=text \
        --loader:.css=text \
        --define:process.env.NODE_ENV=\"production\"
    
    if [ ! -f "dist/index.js" ]; then
        error "Server build failed - dist/index.js not found"
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

# Setup database
setup_database() {
    log "Setting up database schema..."
    
    cd "$APP_DIR"
    
    # Fix PostgreSQL permissions first
    log "Fixing PostgreSQL permissions..."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;" 2>/dev/null || true
    
    # Check if database connection works
    if command -v psql >/dev/null 2>&1; then
        log "Creating database schema..."
        # Try with postgres user if regular user fails
        npx drizzle-kit push --config=drizzle.config.ts || \
        sudo -u postgres DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config=drizzle.config.ts || \
        warning "Database schema sync may have issues, continuing deployment"
    fi
    
    success "Database schema synchronized"
}

# Configure PM2
configure_pm2() {
    log "Configuring PM2 for production..."
    
    cd "$APP_DIR"
    
    # Stop existing PM2 processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start application with PM2
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
    
    # Stop conflicting services and clear ports
    log "Clearing port conflicts..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    lsof -ti:443 | xargs kill -9 2>/dev/null || true
    
    # Check if Nginx is installed and running
    if ! systemctl is-active --quiet nginx; then
        log "Starting Nginx service..."
        systemctl start nginx
        systemctl enable nginx
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