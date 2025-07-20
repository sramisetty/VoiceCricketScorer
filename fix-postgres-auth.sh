#!/bin/bash

# Fix PostgreSQL Authentication Script
# This script fixes the PostgreSQL authentication configuration for cricket_user

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"
DB_PASSWORD="cricket_secure_password_2025"

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

log "Fixing PostgreSQL authentication for Cricket Scorer..."

# Find PostgreSQL configuration files
PG_HBA_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'show hba_file;' 2>/dev/null | tr -d '\n' || echo "")
if [ -z "$PG_HBA_CONF" ]; then
    # Try common locations
    for path in /var/db/postgres/compute/pgdata/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf /var/lib/pgsql/data/pg_hba.conf; do
        if [ -f "$path" ]; then
            PG_HBA_CONF="$path"
            break
        fi
    done
fi

if [ -z "$PG_HBA_CONF" ] || [ ! -f "$PG_HBA_CONF" ]; then
    error "Could not find pg_hba.conf file"
fi

log "Found pg_hba.conf at: $PG_HBA_CONF"

# Create PostgreSQL user and database if they don't exist
log "Creating PostgreSQL user and database..."
sudo -u postgres psql -c "CREATE DATABASE cricket_scorer;" 2>/dev/null || log "Database cricket_scorer already exists"
sudo -u postgres psql -c "CREATE USER cricket_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || log "User cricket_user already exists"
sudo -u postgres psql -c "ALTER USER cricket_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER cricket_user CREATEDB;" 2>/dev/null || true

# Backup original pg_hba.conf
cp "$PG_HBA_CONF" "$PG_HBA_CONF.backup.$(date +%Y%m%d_%H%M%S)"
log "Backed up pg_hba.conf"

# Check if cricket_user entry already exists
if grep -q "cricket_user" "$PG_HBA_CONF"; then
    log "cricket_user entry found in pg_hba.conf, updating..."
    # Update existing entry to use md5 authentication
    sed -i 's/.*cricket_user.*ident.*/local   cricket_scorer    cricket_user                                md5/' "$PG_HBA_CONF"
    sed -i 's/.*cricket_user.*peer.*/local   cricket_scorer    cricket_user                                md5/' "$PG_HBA_CONF"
else
    log "Adding cricket_user entry to pg_hba.conf..."
    # Add new entry for cricket_user with md5 authentication
    # Insert before the default local entries
    sed -i '/^local.*all.*all.*peer/i local   cricket_scorer    cricket_user                                md5' "$PG_HBA_CONF"
fi

# Also ensure host connections work
if ! grep -q "host.*cricket_scorer.*cricket_user.*127.0.0.1" "$PG_HBA_CONF"; then
    sed -i '/^host.*all.*all.*127.0.0.1/i host    cricket_scorer    cricket_user        127.0.0.1/32            md5' "$PG_HBA_CONF"
fi

log "Updated pg_hba.conf for cricket_user authentication"

# Find PostgreSQL service name and restart
log "Restarting PostgreSQL service..."
for service in postgresql@14-main postgresql-14 postgresql@13-main postgresql-13 postgresql@12-main postgresql-12 postgresql; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        systemctl restart "$service"
        log "Restarted $service"
        break
    elif [ -f "/etc/init.d/$service" ]; then
        service "$service" restart
        log "Restarted $service using init.d"
        break
    fi
done

# Wait for PostgreSQL to start
sleep 3

# Test connection
log "Testing database connection..."
if sudo -u postgres psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" 2>/dev/null; then
    log "✓ Database connection successful"
else
    warn "Database connection test failed, but continuing..."
fi

# Navigate to app directory and test with drizzle
if [ -d "$APP_DIR/current" ]; then
    cd "$APP_DIR/current"
elif [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
else
    error "App directory not found"
fi

log "Testing drizzle database connection..."
sudo -u $APP_USER npm run db:push

log "✓ PostgreSQL authentication fixed successfully!"
log "cricket_user can now connect to cricket_scorer database"

# Show pg_hba.conf entries for cricket_user
log "Current pg_hba.conf entries for cricket_user:"
grep cricket_user "$PG_HBA_CONF" || log "No cricket_user entries found"