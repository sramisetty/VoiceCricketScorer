#!/bin/bash

# Cricket Scorer Application Update Script
# This script updates the application while preserving data and configuration

set -e

# Configuration
APP_NAME="cricket-scorer"
APP_USER="cricketapp"
APP_DIR="/opt/cricket-scorer"
BACKUP_DIR="/opt/cricket-scorer-backups"
SERVICE_NAME="cricket-scorer"

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

log "Starting Cricket Scorer application update..."

# Create backup before update
log "Creating backup before update..."
BACKUP_NAME="pre-update-$(date +%Y%m%d-%H%M%S)"
/usr/local/bin/cricket-scorer-backup

# Stop the application
log "Stopping application..."
systemctl stop "$SERVICE_NAME"

# Backup current environment file
cp "$APP_DIR/current/.env" "$BACKUP_DIR/env-backup-$(date +%Y%m%d-%H%M%S)"

# Deploy new version
log "Deploying new version..."
cd "$APP_DIR"

# Backup current to backup directory
if [ -d "current" ]; then
    mv current "$BACKUP_DIR/app-$BACKUP_NAME"
fi

# Create new current directory
mkdir -p current
cd current

# Copy new application files (assuming they're in the same directory as this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR"/* . 2>/dev/null || true
rm -f update.sh deploy.sh

# Restore environment configuration
cp "$BACKUP_DIR/env-backup-$(date +%Y%m%d-%H%M%S)" .env

# Install dependencies and build
log "Installing dependencies..."
sudo -u "$APP_USER" npm install --production

log "Building application..."
sudo -u "$APP_USER" npm run build

# Run database migrations
log "Running database migrations..."
sudo -u "$APP_USER" npm run db:push

# Set proper ownership
chown -R "$APP_USER:$APP_USER" "$APP_DIR/current"

# Start the application
log "Starting application..."
systemctl start "$SERVICE_NAME"

# Wait for startup
sleep 5

# Check if service started successfully
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Application updated and started successfully!"
    systemctl status "$SERVICE_NAME" --no-pager
else
    error "Failed to start application after update. Check logs: journalctl -u $SERVICE_NAME"
fi

log "Update completed successfully!"