#!/bin/bash

# Run Drizzle Kit Push with proper environment setup
# Fixes package resolution issues in production environment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

APP_DIR="/opt/cricket-scorer"

log "Running drizzle-kit push with proper environment setup..."

# Change to application directory
if [ ! -d "$APP_DIR" ]; then
    error "Application directory $APP_DIR not found"
    exit 1
fi

cd "$APP_DIR"

# Set up proper environment variables
log "Setting up environment variables..."
export NODE_ENV=production
export DATABASE_URL="postgresql://cricket_user:abcd1234@localhost:5432/cricket_scorer"

# Verify database connection first
log "Testing database connection..."
if ! PGPASSWORD=abcd1234 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    error "Database connection failed"
    log "Please run: sudo ./fix-database-users.sh"
    exit 1
fi

success "Database connection successful"

# Use npx to run drizzle-kit with proper Node module resolution
log "Running drizzle-kit push with npx..."
if npx drizzle-kit push; then
    success "Database schema synchronized successfully"
else
    log "Direct npx failed, trying with explicit node_modules path..."
    
    # Try with explicit path
    if ./node_modules/.bin/drizzle-kit push; then
        success "Database schema synchronized successfully"
    else
        log "Explicit path failed, trying with node and require resolution..."
        
        # Create a wrapper script to force proper require resolution
        cat > temp_drizzle_push.js << 'EOF'
const { execSync } = require('child_process');
const path = require('path');

// Set NODE_PATH to include local node_modules
process.env.NODE_PATH = path.join(__dirname, 'node_modules');
require('module').Module._initPaths();

// Run drizzle-kit
try {
    execSync('npx drizzle-kit push', { 
        stdio: 'inherit',
        cwd: __dirname,
        env: { 
            ...process.env,
            NODE_PATH: path.join(__dirname, 'node_modules')
        }
    });
    console.log('✓ Database schema synchronized successfully');
} catch (error) {
    console.error('✗ Drizzle push failed:', error.message);
    process.exit(1);
}
EOF
        
        if node temp_drizzle_push.js; then
            success "Database schema synchronized successfully"
            rm -f temp_drizzle_push.js
        else
            error "All drizzle-kit attempts failed"
            rm -f temp_drizzle_push.js
            
            log "Debugging information:"
            log "Current directory: $(pwd)"
            log "NODE_PATH: $NODE_PATH"
            log "drizzle-kit location: $(which drizzle-kit 2>/dev/null || echo 'not in PATH')"
            log "Available drizzle packages:"
            npm list | grep drizzle || echo "No drizzle packages found"
            
            exit 1
        fi
    fi
fi

success "Drizzle push completed successfully!"
log "Database schema is now synchronized"