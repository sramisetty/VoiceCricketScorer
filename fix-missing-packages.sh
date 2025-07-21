is #!/bin/bash

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

# Now run drizzle-kit push with proper environment setup
log "Running drizzle-kit push with proper environment setup..."

# Set up proper environment variables
log "Setting up environment variables..."
export NODE_ENV=production
export DATABASE_URL="postgresql://cricket_user:abcd1234@localhost:5432/cricket_scorer"

# Verify database connection first
log "Testing database connection..."
if ! PGPASSWORD=abcd1234 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    error "Database connection failed"
    log "Please run: sudo ./fix-database-users.sh first"
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

success "Package installation and database schema sync completed!"
log "Database schema is now synchronized and ready for deployment"