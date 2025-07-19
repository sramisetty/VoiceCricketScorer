#!/bin/bash

# Node.js Conflict Resolution Script for Cricket Scorer
# This script fixes Node.js version conflicts on CentOS/RHEL/Fedora systems

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
fi

# Detect package manager
if command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
else
    error "This script is for CentOS/RHEL/Fedora systems only"
fi

log "Fixing Node.js conflicts on $PKG_MANAGER system..."

# Stop Cricket Scorer service if running
log "Stopping Cricket Scorer service..."
systemctl stop cricket-scorer 2>/dev/null || log "Service not running"

# Remove all existing Node.js packages
log "Removing conflicting Node.js packages..."
$PKG_MANAGER remove -y nodejs npm nodejs-npm 2>/dev/null || true

# Remove NodeSource repository if it exists
log "Cleaning up existing NodeSource repository..."
rm -f /etc/yum.repos.d/nodesource*.repo 2>/dev/null || true

# Clean package cache
log "Cleaning package cache..."
if [ "$PKG_MANAGER" = "yum" ]; then
    yum clean all
    yum makecache
elif [ "$PKG_MANAGER" = "dnf" ]; then
    dnf clean all
    dnf makecache
fi

# Install Node.js 20 from NodeSource
log "Installing Node.js 20 from NodeSource..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -

# Install with conflict resolution
log "Installing Node.js with conflict resolution..."
if [ "$PKG_MANAGER" = "yum" ]; then
    yum install -y --allowerasing nodejs
elif [ "$PKG_MANAGER" = "dnf" ]; then
    dnf install -y --allowerasing nodejs
fi

# Verify installation
NODE_VERSION=$(node --version 2>/dev/null || echo "Failed")
NPM_VERSION=$(npm --version 2>/dev/null || echo "Failed")

if [[ "$NODE_VERSION" == v20* ]]; then
    log "✓ Node.js 20 installed successfully: $NODE_VERSION"
    log "✓ NPM version: $NPM_VERSION"
else
    error "Failed to install Node.js 20. Current version: $NODE_VERSION"
fi

# Restart Cricket Scorer service
log "Starting Cricket Scorer service..."
systemctl start cricket-scorer 2>/dev/null && log "✓ Cricket Scorer service started" || warn "Cricket Scorer service not found (run deploy.sh first)"

log "Node.js conflict resolution completed successfully!"