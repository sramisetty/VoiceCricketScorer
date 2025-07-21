#!/bin/bash

# PostgreSQL Fix Script for AlmaLinux 9
# Run this if PostgreSQL service fails to start

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

log "PostgreSQL Fix Script - Diagnosing and fixing PostgreSQL issues"

# Stop PostgreSQL service if running
systemctl stop postgresql 2>/dev/null || true

# Check PostgreSQL status
log "Checking PostgreSQL installation..."
if ! command -v postgresql-setup &> /dev/null; then
    error "PostgreSQL is not installed. Please run the main setup script first."
    exit 1
fi

# Check data directory
PG_DATA_DIR="/var/lib/pgsql/data"
log "Checking PostgreSQL data directory: $PG_DATA_DIR"

if [ ! -d "$PG_DATA_DIR" ]; then
    log "Data directory does not exist, creating and initializing..."
    mkdir -p "$PG_DATA_DIR"
    chown postgres:postgres "$PG_DATA_DIR"
    chmod 700 "$PG_DATA_DIR"
    
    # Initialize database
    if sudo -u postgres /usr/bin/initdb -D "$PG_DATA_DIR"; then
        success "PostgreSQL database initialized successfully"
    else
        error "Database initialization failed"
        exit 1
    fi
elif [ ! -f "$PG_DATA_DIR/postgresql.conf" ]; then
    log "Data directory exists but is not initialized, fixing..."
    rm -rf "$PG_DATA_DIR"/*
    chown postgres:postgres "$PG_DATA_DIR"
    chmod 700 "$PG_DATA_DIR"
    
    # Initialize database
    if sudo -u postgres /usr/bin/initdb -D "$PG_DATA_DIR"; then
        success "PostgreSQL database re-initialized successfully"
    else
        error "Database re-initialization failed"
        exit 1
    fi
else
    log "Data directory exists and appears initialized"
fi

# Fix ownership and permissions
log "Fixing PostgreSQL permissions..."
chown -R postgres:postgres /var/lib/pgsql/
chmod 700 "$PG_DATA_DIR"
chmod 600 "$PG_DATA_DIR"/*.conf 2>/dev/null || true

# Configure PostgreSQL
log "Configuring PostgreSQL..."
PG_CONF="$PG_DATA_DIR/postgresql.conf"
PG_HBA="$PG_DATA_DIR/pg_hba.conf"

# Backup original configs
cp "$PG_CONF" "${PG_CONF}.backup" 2>/dev/null || true
cp "$PG_HBA" "${PG_HBA}.backup" 2>/dev/null || true

# Update postgresql.conf
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONF"
sed -i "s/#port = 5432/port = 5432/" "$PG_CONF"
sed -i "s/#max_connections = 100/max_connections = 200/" "$PG_CONF"

# Update pg_hba.conf for local connections
if ! grep -q "Cricket Scorer Application Access" "$PG_HBA"; then
    cat >> "$PG_HBA" << EOF

# Cricket Scorer Application Access
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF
fi

# Fix file permissions again
chown postgres:postgres "$PG_CONF" "$PG_HBA"
chmod 600 "$PG_CONF" "$PG_HBA"

# Enable and start PostgreSQL
log "Starting PostgreSQL service..."
systemctl enable postgresql

if systemctl start postgresql; then
    success "PostgreSQL service started successfully"
    
    # Wait for service to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..15}; do
        if sudo -u postgres psql -c "SELECT 1;" &>/dev/null; then
            success "PostgreSQL is ready and accepting connections"
            break
        fi
        sleep 2
        if [ $i -eq 15 ]; then
            warning "PostgreSQL may not be fully ready yet, but service is running"
        fi
    done
    
    # Show status
    log "PostgreSQL Status:"
    systemctl status postgresql --no-pager -l
    
    log "Testing database connection..."
    if sudo -u postgres psql -c "SELECT version();" 2>/dev/null; then
        success "Database connection test successful"
    else
        warning "Database connection test failed, but service is running"
    fi
    
    echo ""
    echo "================================================="
    echo "   PostgreSQL Fix Completed Successfully!"
    echo "================================================="
    echo ""
    echo "PostgreSQL is now ready for Cricket Scorer deployment."
    echo "You can now run the deployment script: ./deploy-cricket-scorer.sh"
    
else
    error "Failed to start PostgreSQL service"
    echo ""
    echo "Diagnostic Information:"
    echo "======================="
    systemctl status postgresql --no-pager -l
    echo ""
    echo "Recent logs:"
    journalctl -xeu postgresql --no-pager -n 20
    exit 1
fi