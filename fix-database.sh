#!/bin/bash

# Fix Database Configuration Script
# This script fixes the database configuration to use Neon instead of local PostgreSQL

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

# Navigate to app directory
cd "$APP_DIR/current" || error "App directory not found"

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    log "Backed up current .env file"
fi

# Create new .env with Neon database configuration
SESSION_SECRET=$(openssl rand -base64 32)

cat > .env << 'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Neon Database Configuration (using your actual Neon URL)
DATABASE_URL=postgresql://neondb_owner:npg_7PBLTn0pDhWQ@ep-crimson-forest-advtwxi1.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require

# Session Configuration
EOF

echo "SESSION_SECRET=$SESSION_SECRET" >> .env

cat >> .env << 'EOF'

# OpenAI Configuration (update with your API key)
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
APP_URL=http://localhost:3000
LOG_LEVEL=info
EOF

# Set proper permissions
chown $APP_USER:$APP_USER .env
chmod 600 .env

log "Updated .env file with Neon database configuration"

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
log "Your Cricket Scorer app should now be running with Neon database"

# Show PM2 status
sudo -u $APP_USER pm2 status
EOF