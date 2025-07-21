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

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."
    
    check_root
    build_application
    
    success "Cricket Scorer deployment completed successfully!"
    log "Application should be accessible at: https://$DOMAIN"
}

# Run main function
main "$@"