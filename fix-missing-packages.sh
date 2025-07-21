#!/bin/bash

# Fix Missing Node.js Packages for Cricket Scorer
# Installs drizzle-kit and other missing packages needed for deployment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
    exit 1
fi

APP_DIR="/opt/cricket-scorer"

log "Installing missing Node.js packages for Cricket Scorer..."

# Change to application directory
if [ ! -d "$APP_DIR" ]; then
    error "Application directory $APP_DIR not found"
    exit 1
fi

cd "$APP_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    error "package.json not found in $APP_DIR"
    exit 1
fi

log "Current directory: $(pwd)"

# Install missing packages
log "Installing drizzle-kit and drizzle-orm..."
npm install drizzle-kit drizzle-orm

log "Installing database driver..."
npm install @neondatabase/serverless

log "Installing TypeScript and build tools..."
npm install typescript tsx esbuild

log "Verifying package installation..."

# Verify drizzle-kit is available
if npm list drizzle-kit >/dev/null 2>&1; then
    success "drizzle-kit is now available"
else
    error "drizzle-kit installation failed"
    exit 1
fi

# Verify drizzle-orm is available
if npm list drizzle-orm >/dev/null 2>&1; then
    success "drizzle-orm is now available"
else
    error "drizzle-orm installation failed"
    exit 1
fi

# Test drizzle-kit command
log "Testing drizzle-kit command..."
if ./node_modules/.bin/drizzle-kit --version >/dev/null 2>&1; then
    success "drizzle-kit command works"
else
    warning "drizzle-kit command may have issues"
fi

# Show installed packages
log "Installed package versions:"
npm list drizzle-kit drizzle-orm @neondatabase/serverless typescript tsx 2>/dev/null || true

success "Missing packages installation completed!"
log "You can now run: drizzle-kit push"