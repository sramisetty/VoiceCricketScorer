#!/bin/bash

# Fix Database Configuration Script
# This script fixes the database configuration to use local PostgreSQL

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Fixing database configuration for Cricket Scorer..."

# Check if directory exists, if not try alternative paths
if [ ! -d "$APP_DIR/current" ]; then
    if [ -d "$APP_DIR" ]; then
        WORK_DIR="$APP_DIR"
    elif [ -d "/home/cricketapp/cricket-scorer" ]; then
        WORK_DIR="/home/cricketapp/cricket-scorer"
    else
        error "Cricket scorer app directory not found. Please check installation."
    fi
else
    WORK_DIR="$APP_DIR/current"
fi

# Navigate to app directory
cd "$WORK_DIR" || error "Cannot access app directory"
log "Working in directory: $WORK_DIR"

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    log "Backed up current .env file"
fi

# Create new .env with local PostgreSQL configuration (from deploy-pm2.sh)
SESSION_SECRET=$(openssl rand -base64 32)
DB_PASSWORD="cricket_secure_password_2025"

cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://cricket_user:${DB_PASSWORD}@localhost:5432/cricket_scorer
PGUSER=cricket_user
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=cricket_scorer
PGHOST=localhost
PGPORT=5432

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}

# OpenAI Configuration (update with your API key)
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
APP_URL=http://localhost:3000
LOG_LEVEL=info
EOF

# Set proper permissions
chown $APP_USER:$APP_USER .env
chmod 600 .env

log "Updated .env file with local PostgreSQL database configuration"

# Test database connection
log "Testing database connection..."
sudo -u $APP_USER npm run db:push

# Restart PM2 application
log "Restarting application..."
sudo -u $APP_USER pm2 restart cricket-scorer || {
    warn "PM2 restart failed, trying to start fresh..."
    sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true
    sudo -u $APP_USER pm2 start ecosystem.config.cjs
}

log "✓ Database configuration fixed successfully!"
log "Your Cricket Scorer app should now be running with local PostgreSQL database"

# Show PM2 status
sudo -u $APP_USER pm2 status