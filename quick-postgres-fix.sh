#!/bin/bash

# Quick PostgreSQL Authentication Fix
# Resolves password authentication issues for cricket scorer deployment

set -euo pipefail

DB_PASSWORD="cricket_secure_password_2025"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Fixing PostgreSQL authentication for cricket scorer..."

# Stop PostgreSQL
systemctl stop postgresql

# Backup and reset pg_hba.conf to allow local connections
PG_HBA_CONF="/var/lib/pgsql/data/pg_hba.conf"
cp $PG_HBA_CONF ${PG_HBA_CONF}.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Create permissive pg_hba.conf for setup
cat > $PG_HBA_CONF << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32           trust
host    all             all             ::1/128                trust
EOF

# Start PostgreSQL
systemctl start postgresql
sleep 3

# Set passwords and create users without authentication
log "Setting up database with trust authentication..."
sudo -u postgres psql << EOF
ALTER USER postgres PASSWORD '$DB_PASSWORD';
DROP DATABASE IF EXISTS cricket_scorer;
DROP USER IF EXISTS cricket_user;
CREATE USER cricket_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
CREATE DATABASE cricket_scorer OWNER cricket_user;
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
EOF

# Now set up proper authentication
log "Configuring secure authentication..."
cat > $PG_HBA_CONF << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             cricket_user                            md5
local   all             all                                     peer
host    all             cricket_user    127.0.0.1/32           md5
host    all             all             127.0.0.1/32           md5
host    all             cricket_user    ::1/128                md5
host    all             all             ::1/128                md5
EOF

# Restart PostgreSQL
systemctl restart postgresql
sleep 3

# Test connections
log "Testing database connections..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT version();" >/dev/null 2>&1; then
    log "✅ cricket_user connection successful"
else
    log "❌ cricket_user connection failed, trying postgres user..."
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U postgres -d cricket_scorer -c "SELECT version();" >/dev/null 2>&1; then
        log "✅ postgres user connection successful"
        echo "Use DATABASE_URL=postgresql://postgres:$DB_PASSWORD@localhost:5432/cricket_scorer"
    else
        log "❌ Both connections failed - manual intervention needed"
        exit 1
    fi
fi

log "PostgreSQL authentication fix completed!"