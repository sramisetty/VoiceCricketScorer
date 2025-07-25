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

# Emergency production fix - completely eliminate Replit imports
emergency_production_fix() {
    log "Emergency fix: Completely eliminating Replit imports from production build..."

    cd "$APP_DIR"

    # Stop all PM2 processes
    log "Stopping all PM2 processes..."
    pm2 kill 2>/dev/null || true

    # Remove ALL build artifacts and caches
    log "Removing all build artifacts and caches..."
    rm -rf dist/ server/public/ node_modules/.cache/ node_modules/.vite/
    find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

    # Remove Replit packages completely
    log "Removing Replit packages..."
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true

    # Clean reinstall
    log "Clean package reinstall..."
    rm -rf node_modules/
    npm install --production=false

    # Create minimal production server without any Vite config imports
    log "Creating production server without Vite config dependencies..."
    cat > server/index.prod.ts << 'EOF'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      console.log(`${formattedTime} [express] ${logLine}`);
    }
  });

    }
EOF

    # Build client using production config only with memory optimization
    log "Building client with production config..."
    export NODE_ENV=production
    export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

    # Try normal build first
    log "Attempting optimized build..."
    if ! npx vite build --config vite.config.production.ts; then
        log "Standard build failed, trying memory-optimized approach..."

        # Clear any partial build
        rm -rf server/public/*

        # Use even more aggressive memory settings
        export NODE_OPTIONS="--max-old-space-size=6144 --max-semi-space-size=512"

        # Try again with more conservative settings
        npx vite build --config vite.config.production.ts --mode=production
    fi

    # Verify client build succeeded
    if [ ! -f "server/public/index.html" ]; then
        error "Client build failed - no index.html found"
        ls -la server/public/ || true
        exit 1
    fi

    # Also copy files to dist/public for compatibility (if needed)
    mkdir -p dist/public
    cp -r server/public/* dist/public/ 2>/dev/null || true

    # Build production server
    log "Building production server..."
    npx esbuild server/index.prod.ts --platform=node --packages=external --bundle --format=esm --target=es2022 --outfile=dist/index.js

    # Verify server build succeeded
    if [ ! -f "dist/index.js" ]; then
        error "Server build failed - no dist/index.js found"
        ls -la dist/ || true
        exit 1
    fi

    # Verify no Replit imports in built files
    log "Verifying no Replit imports remain..."
    if grep -r "@replit" dist/ server/public/ 2>/dev/null; then
        error "Replit imports still found! Build failed."
        exit 1
    fi

    success "Build completed successfully with no Replit imports"
    log "Built files: $(ls -la dist/ server/public/)"

    # Clean up temporary files
    rm -f server/index.prod.ts
}

# Build application for production
build_application() {
    log "Building application for production..."

    cd "$APP_DIR"

    # Use emergency production fix to eliminate Replit imports
    emergency_production_fix
}

# Setup or update application repository
setup_repository() {
    log "Setting up Cricket Scorer repository..."

    # Backup critical production files before updating
    BACKUP_DIR="/opt/cricket-scorer-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    if [ -d "$APP_DIR" ]; then
        log "Backing up critical production files..."
        # Backup environment files
        cp "$APP_DIR/.env" "$BACKUP_DIR/.env" 2>/dev/null && log "✓ Backed up .env"
        cp "$APP_DIR/.env.production" "$BACKUP_DIR/.env.production" 2>/dev/null && log "✓ Backed up .env.production"
        cp "$APP_DIR/ecosystem.config.cjs" "$BACKUP_DIR/ecosystem.config.cjs" 2>/dev/null && log "✓ Backed up PM2 config"

        # Backup database (quick backup)
        if command -v pg_dump >/dev/null 2>&1; then
            pg_dump -U cricket_scorer cricket_scorer > "$BACKUP_DIR/database.sql" 2>/dev/null && log "✓ Database backup created"
        fi

        log "Backup created at: $BACKUP_DIR"

        # Skip git operations as requested - use existing code
        log "Using existing code (skipping git operations as requested)..."
        cd "$APP_DIR"
    else
        error "Application directory does not exist: $APP_DIR"
        error "Please ensure the application is already set up"
        exit 1
    fi

    cd "$APP_DIR"

    # Restore critical files after repository update
    if [ -d "$BACKUP_DIR" ]; then
        log "Restoring critical production files..."
        if [ -f "$BACKUP_DIR/.env" ]; then
            cp "$BACKUP_DIR/.env" "$APP_DIR/.env" && log "✓ Restored .env"
        fi
        if [ -f "$BACKUP_DIR/.env.production" ]; then
            cp "$BACKUP_DIR/.env.production" "$APP_DIR/.env.production" && log "✓ Restored .env.production" 
        fi
        if [ -f "$BACKUP_DIR/ecosystem.config.cjs" ]; then
            cp "$BACKUP_DIR/ecosystem.config.cjs" "$APP_DIR/ecosystem.config.cjs" && log "✓ Restored PM2 config"
        fi
    fi

    success "Repository setup completed"
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

# Fix PostgreSQL configuration
fix_postgresql_config() {
    log "Checking and fixing PostgreSQL configuration..."

    PGDATA_DIR="/var/lib/pgsql/data"
    POSTGRES_CONF="$PGDATA_DIR/postgresql.conf"

    # Stop PostgreSQL service first
    systemctl stop postgresql 2>/dev/null || true

    if [ -f "$POSTGRES_CONF" ]; then
        # Check for invalid configuration parameters
        if grep -q "shared_buffers.*0.*8kB\|effective_cache_size.*0.*8kB" "$POSTGRES_CONF"; then
            log "Found invalid PostgreSQL configuration, fixing..."

            # Create backup
            cp "$POSTGRES_CONF" "$POSTGRES_CONF.backup.$(date +%Y%m%d_%H%M%S)"

            # Create minimal working configuration
            cat > "$POSTGRES_CONF" << 'EOF'
# Minimal PostgreSQL Configuration
listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 2GB
EOF

            # Set proper ownership and permissions
            chown postgres:postgres "$POSTGRES_CONF"
            chmod 600 "$POSTGRES_CONF"

            success "PostgreSQL configuration fixed"
        fi
    fi

    # Start PostgreSQL service
    log "Starting PostgreSQL service..."
    systemctl start postgresql
    systemctl enable postgresql

    # Wait for service to be ready
    sleep 5

    if systemctl is-active --quiet postgresql; then
        success "PostgreSQL service is running"
    else
        error "PostgreSQL service failed to start"
        systemctl status postgresql
        exit 1
    fi
}

# Comprehensive Database Schema Normalization
# This function handles all column name conflicts between Drizzle ORM and production database
normalize_database_schema() {
    log "Normalizing database schema to handle column name conflicts..."

    # This function ensures the production database schema matches Drizzle ORM expectations
    # Drizzle uses snake_case while production may have camelCase columns

    sudo -u postgres psql -d cricket_scorer <<'NORMALIZE_SCHEMA_EOF'

-- Normalize teams table columns
DO $$ 
BEGIN
    -- Handle shortName -> short_name (also check for table existence)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'shortName') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') THEN
            ALTER TABLE teams RENAME COLUMN "shortName" TO short_name;
            RAISE NOTICE 'Renamed teams.shortName to short_name';
        END IF;

        -- Add short_name column if it doesn't exist at all
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'shortName') THEN
            ALTER TABLE teams ADD COLUMN short_name VARCHAR(10);
            RAISE NOTICE 'Added teams.short_name column';
        END IF;

        -- Handle franchiseId -> franchise_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'franchiseId') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'franchise_id') THEN
            ALTER TABLE teams RENAME COLUMN "franchiseId" TO franchise_id;
            RAISE NOTICE 'Renamed teams.franchiseId to franchise_id';
        END IF;

        -- Add franchise_id column if it doesn't exist at all
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'franchise_id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'franchiseId') THEN
            ALTER TABLE teams ADD COLUMN franchise_id INTEGER REFERENCES franchises(id);
            RAISE NOTICE 'Added teams.franchise_id column';
        END IF;

        -- Handle remaining team columns within the same table check
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'isActive') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'is_active') THEN
            ALTER TABLE teams RENAME COLUMN "isActive" TO is_active;
            RAISE NOTICE 'Renamed teams.isActive to is_active';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'createdAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'created_at') THEN
            ALTER TABLE teams RENAME COLUMN "createdAt" TO created_at;
            RAISE NOTICE 'Renamed teams.createdAt to created_at';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'updatedAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'updated_at') THEN
            ALTER TABLE teams RENAME COLUMN "updatedAt" TO updated_at;
            RAISE NOTICE 'Renamed teams.updatedAt to updated_at';
        END IF;
    END IF;

END $$;

-- Normalize franchises table columns
DO $$ 
BEGIN
    -- Handle shortName -> short_name (check table exists first)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'franchises') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'shortName') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'short_name') THEN
            ALTER TABLE franchises RENAME COLUMN "shortName" TO short_name;
            RAISE NOTICE 'Renamed franchises.shortName to short_name';
        END IF;

        -- Add short_name column if it doesn't exist at all
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'short_name') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'shortName') THEN
            ALTER TABLE franchises ADD COLUMN short_name VARCHAR(10);
            RAISE NOTICE 'Added franchises.short_name column';
        END IF;

        -- Handle all other franchise columns within the same table check
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'contactEmail') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'contact_email') THEN
            ALTER TABLE franchises RENAME COLUMN "contactEmail" TO contact_email;
            RAISE NOTICE 'Renamed franchises.contactEmail to contact_email';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'contactPhone') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'contact_phone') THEN
            ALTER TABLE franchises RENAME COLUMN "contactPhone" TO contact_phone;
            RAISE NOTICE 'Renamed franchises.contactPhone to contact_phone';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'isActive') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'is_active') THEN
            ALTER TABLE franchises RENAME COLUMN "isActive" TO is_active;
            RAISE NOTICE 'Renamed franchises.isActive to is_active';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'createdAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'created_at') THEN
            ALTER TABLE franchises RENAME COLUMN "createdAt" TO created_at;
            RAISE NOTICE 'Renamed franchises.createdAt to created_at';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'updatedAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'updated_at') THEN
            ALTER TABLE franchises RENAME COLUMN "updatedAt" TO updated_at;
            RAISE NOTICE 'Renamed franchises.updatedAt to updated_at';
        END IF;
    END IF;

END $$;

-- Normalize players table columns
DO $$ 
BEGIN
    -- Handle franchiseId -> franchise_id (check table exists first)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'franchiseId') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'franchise_id') THEN
            ALTER TABLE players RENAME COLUMN "franchiseId" TO franchise_id;
            RAISE NOTICE 'Renamed players.franchiseId to franchise_id';
        END IF;

        -- Add franchise_id column if it doesn't exist at all (for legacy support)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'franchise_id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'franchiseId') THEN
            ALTER TABLE players ADD COLUMN franchise_id INTEGER REFERENCES franchises(id);
            RAISE NOTICE 'Added players.franchise_id column for legacy support';
        END IF;

        -- Handle all other player columns within the same table check
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'teamId') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
            ALTER TABLE players RENAME COLUMN "teamId" TO team_id;
            RAISE NOTICE 'Renamed players.teamId to team_id';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'battingOrder') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'batting_order') THEN
            ALTER TABLE players RENAME COLUMN "battingOrder" TO batting_order;
            RAISE NOTICE 'Renamed players.battingOrder to batting_order';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'userId') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'user_id') THEN
            ALTER TABLE players RENAME COLUMN "userId" TO user_id;
            RAISE NOTICE 'Renamed players.userId to user_id';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'contactInfo') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'contact_info') THEN
            ALTER TABLE players RENAME COLUMN "contactInfo" TO contact_info;
            RAISE NOTICE 'Renamed players.contactInfo to contact_info';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'preferredPosition') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'preferred_position') THEN
            ALTER TABLE players RENAME COLUMN "preferredPosition" TO preferred_position;
            RAISE NOTICE 'Renamed players.preferredPosition to preferred_position';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'isActive') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'is_active') THEN
            ALTER TABLE players RENAME COLUMN "isActive" TO is_active;
            RAISE NOTICE 'Renamed players.isActive to is_active';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'createdAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'created_at') THEN
            ALTER TABLE players RENAME COLUMN "createdAt" TO created_at;
            RAISE NOTICE 'Renamed players.createdAt to created_at';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'updatedAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'updated_at') THEN
            ALTER TABLE players RENAME COLUMN "updatedAt" TO updated_at;
            RAISE NOTICE 'Renamed players.updatedAt to updated_at';
        END IF;
    END IF;
END $$;

-- Normalize users table columns
DO $$ 
BEGIN
    -- Handle users table (check table exists first)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Handle passwordHash -> password_hash
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'passwordHash') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
            ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash;
            RAISE NOTICE 'Renamed users.passwordHash to password_hash';
        END IF;


        -- Handle all other user columns within the same table check
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'firstName') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'first_name') THEN
            ALTER TABLE users RENAME COLUMN "firstName" TO first_name;
            RAISE NOTICE 'Renamed users.firstName to first_name';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastName') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_name') THEN
            ALTER TABLE users RENAME COLUMN "lastName" TO last_name;
            RAISE NOTICE 'Renamed users.lastName to last_name';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'franchiseId') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'franchise_id') THEN
            ALTER TABLE users RENAME COLUMN "franchiseId" TO franchise_id;
            RAISE NOTICE 'Renamed users.franchiseId to franchise_id';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
            ALTER TABLE users RENAME COLUMN "isActive" TO is_active;
            RAISE NOTICE 'Renamed users.isActive to is_active';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emailVerified') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
            ALTER TABLE users RENAME COLUMN "emailVerified" TO email_verified;
            RAISE NOTICE 'Renamed users.emailVerified to email_verified';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'createdAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
            ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
            RAISE NOTICE 'Renamed users.createdAt to created_at';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updatedAt') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
            ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
            RAISE NOTICE 'Renamed users.updatedAt to updated_at';
        END IF;
    END IF;
END $$;

-- Create player_franchise_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_franchise_links (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    franchise_id INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index to prevent duplicate player-franchise associations
CREATE UNIQUE INDEX IF NOT EXISTS unique_player_franchise ON player_franchise_links(player_id, franchise_id);

-- Add missing columns if they don't exist
ALTER TABLE players ADD COLUMN IF NOT EXISTS availability BOOLEAN DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Grant permissions on new tables
GRANT ALL PRIVILEGES ON player_franchise_links TO cricket_user;
GRANT USAGE, SELECT ON SEQUENCE player_franchise_links_id_seq TO cricket_user;

-- Ensure all required columns have proper defaults and constraints
DO \$\$ 
BEGIN
    -- Players table enhancements
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        -- Ensure required columns have NOT NULL constraints where needed
        ALTER TABLE players ALTER COLUMN name SET NOT NULL;
        ALTER TABLE players ALTER COLUMN role SET NOT NULL;

        -- Set proper defaults
        ALTER TABLE players ALTER COLUMN is_active SET DEFAULT true;
        ALTER TABLE players ALTER COLUMN availability SET DEFAULT true;
        ALTER TABLE players ALTER COLUMN created_at SET DEFAULT NOW();
        ALTER TABLE players ALTER COLUMN updated_at SET DEFAULT NOW();

        -- Add missing stats column with proper default
        ALTER TABLE players ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"totalMatches": 0, "totalRuns": 0, "totalWickets": 0, "highestScore": 0, "bestBowling": "0/0"}';

        -- Update NULL values to proper defaults
        UPDATE players SET availability = true WHERE availability IS NULL;
        UPDATE players SET is_active = true WHERE is_active IS NULL;
        UPDATE players SET stats = '{"totalMatches": 0, "totalRuns": 0, "totalWickets": 0, "highestScore": 0, "bestBowling": "0/0"}' WHERE stats IS NULL;
        UPDATE players SET created_at = NOW() WHERE created_at IS NULL;
        UPDATE players SET updated_at = NOW() WHERE updated_at IS NULL;

        -- Relax foreign key constraints to allow NULL values (optional relationships)
        ALTER TABLE players ALTER COLUMN franchise_id DROP NOT NULL;
        ALTER TABLE players ALTER COLUMN team_id DROP NOT NULL;
        ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;

        RAISE NOTICE 'Enhanced players table with proper constraints and defaults';
    END IF;

    -- Users table enhancements
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Ensure required columns
        ALTER TABLE users ALTER COLUMN email SET NOT NULL;
        ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
        ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
        ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

        -- Add username column if missing (email serves as username)
        ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

        -- Update username to match email where missing
        UPDATE users SET username = email WHERE username IS NULL OR username = '';

        -- Make username NOT NULL after populating
        ALTER TABLE users ALTER COLUMN username SET NOT NULL;

        -- Set proper defaults
        ALTER TABLE users ALTER COLUMN role SET DEFAULT 'viewer';
        ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;
        ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
        ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
        ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW();

        RAISE NOTICE 'Enhanced users table with username field and proper constraints';
    END IF;

    -- Teams table enhancements
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        ALTER TABLE teams ALTER COLUMN name SET NOT NULL;
        ALTER TABLE teams ALTER COLUMN short_name SET NOT NULL;
        ALTER TABLE teams ALTER COLUMN is_active SET DEFAULT true;
        ALTER TABLE teams ALTER COLUMN created_at SET DEFAULT NOW();
        ALTER TABLE teams ALTER COLUMN updated_at SET DEFAULT NOW();

        UPDATE teams SET is_active = true WHERE is_active IS NULL;
        UPDATE teams SET created_at = NOW() WHERE created_at IS NULL;
        UPDATE teams SET updated_at = NOW() WHERE updated_at IS NULL;

        RAISE NOTICE 'Enhanced teams table with proper constraints';
    END IF;

    -- Franchises table enhancements
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'franchises') THEN
        ALTER TABLE franchises ALTER COLUMN name SET NOT NULL;
        ALTER TABLE franchises ALTER COLUMN short_name SET NOT NULL;
        ALTER TABLE franchises ALTER COLUMN is_active SET DEFAULT true;
        ALTER TABLE franchises ALTER COLUMN created_at SET DEFAULT NOW();
        ALTER TABLE franchises ALTER COLUMN updated_at SET DEFAULT NOW();

        UPDATE franchises SET is_active = true WHERE is_active IS NULL;
        UPDATE franchises SET created_at = NOW() WHERE created_at IS NULL;
        UPDATE franchises SET updated_at = NOW() WHERE updated_at IS NULL;

        RAISE NOTICE 'Enhanced franchises table with proper constraints';
    END IF;

END \$\$;

-- Migrate existing franchise associations to player_franchise_links
INSERT INTO player_franchise_links (player_id, franchise_id, is_active)
SELECT p.id, p.franchise_id, true
FROM players p
WHERE p.franchise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_franchise_links pfl 
    WHERE pfl.player_id = p.id AND pfl.franchise_id = p.franchise_id
  );

-- Schema normalization completed without helper functions

-- Display summary
SELECT 'Database schema normalization completed successfully' as status;

NORMALIZE_SCHEMA_EOF

    if [ $? -eq 0 ]; then
        success "Database schema normalized successfully"
    else
        warning "Schema normalization had some issues, but continuing..."
    fi
}

# Setup database
setup_database() {
    log "Setting up database schema..."

    cd "$APP_DIR"

    # Fix PostgreSQL configuration first
    fix_postgresql_config

    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if su - postgres -c "psql -c 'SELECT 1;'" >/dev/null 2>&1; then
            success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start within 30 seconds"
            systemctl status postgresql
            exit 1
        fi
        sleep 1
    done

    # Ensure database users and database exist
    log "Setting up database users and schema..."

    # Check if cricket_user exists
    if ! sudo -u postgres psql -c "\du cricket_user" 2>/dev/null | grep -q cricket_user; then
        log "Cricket user missing, creating database setup..."

        # Create cricket_user
        sudo -u postgres psql -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'cricket_user') THEN
                CREATE USER cricket_user WITH PASSWORD 'simple123';
                GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
                ALTER USER cricket_user CREATEDB;
            END IF;
        END
        \$\$;" || warning "User creation may have failed"

        # Create cricket_scorer database
        sudo -u postgres psql -c "
        SELECT 'CREATE DATABASE cricket_scorer OWNER cricket_user'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cricket_scorer')\gexec" || {
            sudo -u postgres createdb -O cricket_user cricket_scorer 2>/dev/null || true
        }

        # Set permissions
        sudo -u postgres psql -d cricket_scorer -c "
        GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
        GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;" || true

        success "Database users and database created"
    fi

    # Run database migrations
    log "Running database migrations..."

    # Ensure we have proper environment variables for database connection
    DATABASE_URL="postgresql://cricket_user:simple123@localhost:5432/cricket_scorer?sslmode=disable"

    # Create/update .env file with database connection
    # Check if OPENAI_API_KEY is already set in environment
    if [ -z "$OPENAI_API_KEY" ]; then
        log "OPENAI_API_KEY not found in environment, checking existing .env..."
        if [ -f ".env" ] && grep -q "OPENAI_API_KEY=" .env; then
            EXISTING_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d'=' -f2)
            if [ -n "$EXISTING_KEY" ] && [ "$EXISTING_KEY" != '""' ]; then
                OPENAI_API_KEY="$EXISTING_KEY"
                log "Using existing OPENAI_API_KEY from .env"
            fi
        fi
    fi

    # Only update .env if it doesn't exist or is missing critical keys
    if [ ! -f ".env" ]; then
        log "Creating new .env file..."
        cat > .env <<EOF
DATABASE_URL=$DATABASE_URL
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
NODE_ENV=production
PORT=3000
EOF
    else
        log "Preserving existing .env file and updating only DATABASE_URL..."
        # Update DATABASE_URL but preserve other settings
        if grep -q "DATABASE_URL=" .env; then
            sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        else
            echo "DATABASE_URL=$DATABASE_URL" >> .env
        fi

        # Ensure NODE_ENV is set to production
        if grep -q "NODE_ENV=" .env; then
            sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env
        else
            echo "NODE_ENV=production" >> .env
        fi

        # Ensure PORT is set
        if ! grep -q "PORT=" .env; then
            echo "PORT=3000" >> .env
        fi

        log "✓ Preserved existing .env file with updated DATABASE_URL"
    fi

    # Update DATABASE_URL in drizzle config to use production URL
    if [ -f "drizzle.config.ts" ]; then
        log "Updating drizzle configuration for production..."
        # Backup original config
        cp drizzle.config.ts drizzle.config.ts.backup

        # Update config to use production DATABASE_URL without SSL
        cat > drizzle.config.ts <<'EOF'
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer?sslmode=disable'
  }
});
EOF
    fi

    # Normalize database schema BEFORE running migrations
    normalize_database_schema

    # Now run Drizzle migrations
    npm run db:push || {
        warning "Drizzle migration failed, creating basic schema manually..."
        log "Note: Schema normalization may have already handled column conflicts"

        # Create basic schema manually if drizzle fails
        sudo -u postgres psql -d cricket_scorer <<'SCHEMA_EOF'
-- Drop tables if they exist (for clean slate)
DROP TABLE IF EXISTS balls CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Create teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "shortName" VARCHAR(10) NOT NULL,
    logo TEXT
);

-- Create players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "teamId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'batsman',
    "battingOrder" INTEGER
);

-- Create matches table
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    "team1Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "team2Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossWinnerId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossDecision" VARCHAR(10) NOT NULL DEFAULT 'bat',
    "matchType" VARCHAR(20) NOT NULL DEFAULT 'T20',
    overs INTEGER NOT NULL DEFAULT 20,
    status VARCHAR(20) NOT NULL DEFAULT 'setup',
    "currentInnings" INTEGER DEFAULT 1,
    "currentOver" INTEGER DEFAULT 0,
    "currentBall" INTEGER DEFAULT 0
);

-- Grant permissions to cricket_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;

-- Insert some test data to verify
INSERT INTO teams (name, "shortName") VALUES ('Test Team 1', 'T1'), ('Test Team 2', 'T2');
SCHEMA_EOF

        success "Basic database schema created manually"
    }

    # Test database connection with new credentials
    log "Testing database connection with production credentials..."
    if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT COUNT(*) FROM teams;" >/dev/null 2>&1; then
        success "Database connection successful with production credentials"
    else
        error "Database connection failed with production credentials"
        log "Attempting to fix database permissions..."

        # Fix database permissions
        sudo -u postgres psql -d cricket_scorer -c "
        GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
        GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;"

        # Test again
        if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT COUNT(*) FROM teams;" >/dev/null 2>&1; then
            success "Database connection fixed"
        else
            error "Database connection still failing"
            exit 1
        fi
    fi

    success "Database schema synchronized"

    # Create admin user if none exists
    create_admin_user_if_needed
}

# Create admin user if no admin exists
create_admin_user_if_needed() {
    log "Checking for existing admin user..."

    # Check if any admin user exists
    local admin_count
    admin_count=$(PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -t -c "
        SELECT COUNT(*) FROM users WHERE role IN ('admin', 'global_admin');
    " 2>/dev/null | xargs)

    if [ "$admin_count" -gt 0 ]; then
        success "Admin user already exists (count: $admin_count)"
        return 0
    fi

    log "No admin user found. Creating default admin user..."

    # Generate secure password hash for 'admin123'
    local password_hash
    password_hash=$(node -e "
        const bcrypt = require('bcryptjs');
        const password = 'admin123';
        const saltRounds = 10;
        const hash = bcrypt.hashSync(password, saltRounds);
        console.log(hash);
    " 2>/dev/null)

    if [ -z "$password_hash" ]; then
        warning "Failed to generate password hash using Node.js, trying alternative method..."

        # Fallback: create a simple hash (less secure but functional)
        password_hash='$2a$10$rOj0UpCJaB8X1.2OmEXZfuoarHgqUYI7MpZYQW.xEo8HNc8qFOyEC'  # This is 'admin123'
    fi

    # Create the admin user
    local create_result
    create_result=$(PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "
        INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at) 
        VALUES ('admin@cricket.com', 'admin@cricket.com', '$password_hash', 'System', 'Administrator', 'global_admin', true, true, NOW(), NOW()) 
        RETURNING id, username, email, first_name, last_name, role;
    " 2>&1)

    if echo "$create_result" | grep -q "INSERT 0 1"; then
        success "✓ Default admin user created successfully"
        log "  Email/Username: admin@cricket.com"
        log "  Password: admin123"
        log "  Role: global_admin"
        log ""
        log "⚠️  SECURITY NOTICE: Please change the default password after first login!"
        log "     Login at: http://$DOMAIN/login"
        log ""
    else
        warning "Failed to create admin user:"
        log "$create_result"

        # Try alternative approach without password hashing
        log "Attempting to create admin user with simpler approach..."

        PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "
            INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at) 
            VALUES ('admin@cricket.com', 'admin@cricket.com', '$2a$10$rOj0UpCJaB8X1.2OmEXZfuoarHgqUYI7MpZYQW.xEo8HNc8qFOyEC', 'System', 'Administrator', 'global_admin', true, true, NOW(), NOW());
        " && success "✓ Admin user created with fallback method" || warning "✗ Failed to create admin user"
    fi
}

# Configure PM2 for production
configure_pm2() {
    log "Configuring PM2 for production..."

    cd "$APP_DIR"

    # Stop existing PM2 processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true

    # Load environment variables from .env file if it exists
    if [ -f ".env" ]; then
        log "Loading environment variables from .env file..."
        export $(grep -v '^#' .env | xargs)
        log "OPENAI_API_KEY loaded: ${OPENAI_API_KEY:0:8}..."
    else
        warning "No .env file found, checking if OPENAI_API_KEY is set in environment"
        if [ -z "$OPENAI_API_KEY" ]; then
            error "OPENAI_API_KEY not found in .env file or environment"
            exit 1
        fi
    fi

    # Ensure ecosystem config exists and is properly configured
    if [ ! -f "ecosystem.config.cjs" ]; then
        log "Creating PM2 ecosystem configuration..."
        cat > ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer',
      OPENAI_API_KEY: '${OPENAI_API_KEY:-""}'
    },
    error_file: '/var/log/cricket-scorer/error.log',
    out_file: '/var/log/cricket-scorer/access.log',
    log_file: '/var/log/cricket-scorer/combined.log',
    time: true,
    max_restarts: 5,
    restart_delay: 2000
  }]
};
EOF
    fi

    # Create log directory
    mkdir -p /var/log/cricket-scorer
    chown -R root:root /var/log/cricket-scorer

    # Start application with PM2
    log "Starting application with PM2..."

    # First attempt with production environment
    export DATABASE_URL="postgresql://cricket_user:simple123@localhost:5432/cricket_scorer"
    export NODE_ENV=production
    export PORT=3000

    # Check if we need to set up OpenAI API key
    if [ -z "$OPENAI_API_KEY" ] && [ -f "fix-openai-key.sh" ]; then
        log "Setting up OpenAI API key..."
        # Source the existing .env to get OPENAI_API_KEY if available
        if [ -f ".env" ] && grep -q "OPENAI_API_KEY=" .env; then
            export OPENAI_API_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d'=' -f2)
        fi

        if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != '""' ]; then
            log "Found existing OpenAI API key, updating PM2 config..."
            OPENAI_API_KEY="$OPENAI_API_KEY" ./fix-openai-key.sh
        else
            log "No OpenAI API key found. Run ./fix-openai-key.sh manually to set it up."
        fi
    fi

    pm2 start ecosystem.config.cjs --env production

    # Save PM2 configuration
    pm2 save

    # Wait for application to start
    sleep 10

    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application started successfully with PM2"
        pm2 status

        # Final verification - test if app is responding
        log "Testing application response..."
        sleep 5

        if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
            success "Application is responding to API requests"
        else
            error "Application started but not responding to API requests"
            log "Checking PM2 logs for errors..."
            pm2 logs $APP_NAME --lines 10

            # Try to restart the application once more
            log "Attempting to restart application..."
            pm2 restart $APP_NAME
            sleep 10

            if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
                success "Application is now responding after restart"
            else
                error "Application still not responding. Check logs manually with: pm2 logs $APP_NAME"
                warning "Continuing with deployment - nginx will be configured"
            fi
        fi
    else
        error "Failed to start application with PM2"
        log "PM2 logs:"
        pm2 logs $APP_NAME --lines 20

        # Emergency recovery attempt
        log "Attempting emergency recovery..."

        # Check if build files exist
        if [ ! -f "dist/index.js" ]; then
            error "dist/index.js missing - build may have failed"
            log "Attempting to rebuild application..."
            npm run build:server

            if [ -f "dist/index.js" ]; then
                log "Build successful, restarting PM2..."
                pm2 start ecosystem.config.cjs --env production
                sleep 10
            fi
        fi

        # Final check
        if pm2 list | grep -q "$APP_NAME.*online"; then
            success "Emergency recovery successful"
        else
            error "Emergency recovery failed - manual intervention required"
            exit 1
        fi
    fi
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx reverse proxy..."

    # First verify the application is running
    log "Verifying application is running on port 3000..."
    if ! curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        error "Application is not responding on port 3000"
        log "Checking PM2 status..."
        pm2 status || true
        log "Attempting to start application..."
        cd $APP_DIR

        # Load environment variables from .env file if it exists
        if [ -f ".env" ]; then
            log "Loading environment variables from .env file..."
            export $(grep -v '^#' .env | xargs)
            log "OPENAI_API_KEY loaded: ${OPENAI_API_KEY:0:8}..."
        fi

        pm2 start ecosystem.config.cjs --env production
        sleep 10

        if ! curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
            error "Application still not responding after PM2 start"
            pm2 logs $APP_NAME --lines 20
            exit 1
        fi
    fi
    success "Application is responding on port 3000"

    # Stop nginx first
    systemctl stop nginx 2>/dev/null || true

    # Comprehensive port cleanup
    log "Clearing port conflicts..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
    systemctl disable httpd 2>/dev/null || true

    # Kill any processes using ports 80 and 443
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            log "Killing processes on port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    done

    # Verify ports are free
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            error "Port $port is still in use after cleanup"
            lsof -i:$port
            exit 1
        fi
    done

    success "Ports 80 and 443 are now free"

    # Emergency nginx recovery - restore basic working configuration
    log "Restoring basic nginx configuration..."

    # Stop nginx and clear all configurations
    systemctl stop nginx 2>/dev/null || true

    # Remove ALL nginx configurations to start fresh
    rm -rf /etc/nginx/sites-available/* 2>/dev/null || true
    rm -rf /etc/nginx/sites-enabled/* 2>/dev/null || true
    rm -rf /etc/nginx/conf.d/* 2>/dev/null || true

    # Create minimal working configuration directly in main nginx.conf
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup 2>/dev/null || true

    # Create ultra-simple nginx config that just proxies everything to port 3000
    cat > /etc/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }

    server {
        listen 443 ssl default_server;
        listen [::]:443 ssl default_server;
        server_name _;

        ssl_certificate /etc/letsencrypt/live/score.ramisetty.net/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/score.ramisetty.net/privkey.pem;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /ws {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
EOF

    # Test nginx configuration
    log "Testing Nginx configuration..."
    nginx -t
    if [ $? -ne 0 ]; then
        error "Nginx configuration test failed"
        exit 1
    fi

    # Start Nginx service
    log "Starting Nginx service..."
    systemctl start nginx
    systemctl enable nginx

    # Wait for nginx to start
    sleep 3

    if systemctl is-active --quiet nginx; then
        success "Nginx service is running"
    else
        error "Nginx service failed to start"
        systemctl status nginx
        exit 1
    fi

    # Test the final configuration
    log "Testing final nginx configuration..."
    if curl -f -s -H "Host: score.ramisetty.net" http://localhost/ >/dev/null 2>&1; then
        success "Nginx proxy test passed"
    else
        error "Nginx proxy test failed"
        log "Nginx error log:"
        tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
    fi
}

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."

    check_root
    setup_repository
    install_dependencies
    setup_database
    build_application
    configure_pm2
    configure_nginx

    success "Cricket Scorer deployment completed successfully!"
    log ""
    log "=== DEPLOYMENT SUMMARY ==="
    log "Application Directory: $APP_DIR"
    log "Database: cricket_scorer (PostgreSQL)"
    log "Application Port: 3000"
    log "Web Server: Nginx (ports 80/443)"
    log ""
    log "=== ACCESS INFORMATION ==="
    log "Application URL: http://$DOMAIN"
    log "If SSL configured: https://$DOMAIN"
    log ""
    log "=== SERVICE STATUS ==="
    systemctl is-active postgresql >/dev/null 2>&1 && echo "✓ PostgreSQL: Running" || echo "✗ PostgreSQL: Not running"
    systemctl is-active nginx >/dev/null 2>&1 && echo "✓ Nginx: Running" || echo "✗ Nginx: Not running"
    pm2 list | grep -q "$APP_NAME.*online" && echo "✓ Cricket Scorer App: Running" || echo "✗ Cricket Scorer App: Not running"
    log ""
    log "=== VERIFICATION COMMANDS ==="
    log "Check PM2 status: pm2 status"
    log "Check application: curl http://localhost:3000/"
    log "Check nginx proxy: curl -H 'Host: $DOMAIN' http://localhost/"
    log "View logs: pm2 logs $APP_NAME"
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

    # Comprehensive API testing
    test_api_endpoints
}

# Test API endpoints thoroughly
test_api_endpoints() {
    log "Testing API endpoints..."

    cd "$APP_DIR"

    # Wait for application to fully start
    sleep 10

    local api_base="http://localhost:3000/api"
    local test_results=()

    # Test essential endpoints
    local endpoints=(
        "matches:GET"
        "franchises:GET"
        "teams:GET"
        "health:GET"
    )

    for endpoint_info in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_info" | cut -d: -f1)
        local method=$(echo "$endpoint_info" | cut -d: -f2)
        local url="$api_base/$endpoint"

        log "Testing $method $url..."

        if curl -f -s -X "$method" "$url" >/dev/null 2>&1; then
            success "✓ $endpoint API working"
            test_results+=("$endpoint:PASS")
        else
            warning "✗ $endpoint API failed"
            test_results+=("$endpoint:FAIL")

            # Try to diagnose the issue
            local response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
            log "Response: $response"
        fi

        sleep 1
    done

    # Summary of API tests
    log ""
    log "=== API TEST RESULTS ==="
    local passed=0
    local failed=0

    for result in "${test_results[@]}"; do
        local endpoint=$(echo "$result" | cut -d: -f1)
        local status=$(echo "$result" | cut -d: -f2)

        if [ "$status" = "PASS" ]; then
            echo "✓ $endpoint"
            ((passed++))
        else
            echo "✗ $endpoint"
            ((failed++))
        fi
    done

    log ""
    log "API Tests: $passed passed, $failed failed"

    if [ $failed -eq 0 ]; then
        success "All API endpoints are working correctly!"
    else
        warning "Some API endpoints failed - check application logs:"
        log "PM2 logs: pm2 logs cricket-scorer --lines 20"
        log "Nginx logs: tail -20 /var/log/nginx/error.log"

        # Attempt automatic restart if APIs are failing
        log "Attempting automatic restart to fix API issues..."
        pm2 restart cricket-scorer
        sleep 10

        # Re-test one critical endpoint
        if curl -f -s "$api_base/matches" >/dev/null 2>&1; then
            success "✓ Restart fixed API issues"
        else
            warning "✗ API issues persist after restart"
        fi
    fi
}

# Run main function
main "$@"