#!/bin/bash

# Simple Replit Dependency Fix
# Only removes Replit packages without changing working build process

set -e

APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Simple fix: Just remove Replit packages and rebuild
simple_fix() {
    log "Applying simple Replit dependency fix..."
    
    cd "$APP_DIR"
    
    # Remove only Replit packages
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    # Remove Replit script from HTML
    sed -i '/<script.*replit-dev-banner\.js/d' client/index.html
    
    # Use the existing working build process
    log "Building with existing configuration..."
    NODE_ENV=production npx vite build --config vite.config.production.ts --mode production
    
    # Build server
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
    
    success "Simple fix completed"
}

# Test and deploy
test_and_deploy() {
    log "Testing application..."
    
    cd "$APP_DIR"
    
    # Test locally
    export NODE_ENV=production
    export PORT=3000
    export DATABASE_URL="postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer"
    
    timeout 10s node dist/index.js &
    APP_PID=$!
    sleep 5
    
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application works!"
        kill $APP_PID 2>/dev/null || true
    else
        error "Application test failed"
        kill $APP_PID 2>/dev/null || true
        exit 1
    fi
    
    # Deploy with PM2
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    pm2 start ecosystem.config.cjs --env production
    pm2 save
    
    sleep 5
    
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Deployed successfully!"
        log "Application should be accessible at your domain"
    else
        error "PM2 deployment failed"
        pm2 logs $APP_NAME --lines 10
    fi
}

# Main execution
main() {
    log "Starting simple Replit dependency fix..."
    
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
    
    simple_fix
    test_and_deploy
    
    success "Simple fix completed successfully!"
}

main "$@"