#!/bin/bash

# Database Users and Schema Fix Script
# Recreates missing PostgreSQL users and databases

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
    exit 1
fi

log "Database Users and Schema Setup Starting..."

# Ensure PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    log "Starting PostgreSQL service..."
    systemctl start postgresql || {
        error "Failed to start PostgreSQL service"
        exit 1
    }
fi

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
        success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "PostgreSQL failed to be ready within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Create PostgreSQL user and database for Cricket Scorer
log "Creating PostgreSQL user and database..."

# Set postgres user password (if not already set)
log "Setting postgres user password..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres_admin_pass';" 2>/dev/null || true

# Create cricket_user if it doesn't exist
log "Creating cricket_user..."
sudo -u postgres psql -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'cricket_user') THEN
        -- abcd1234
        CREATE USER cricket_user WITH PASSWORD 'abcd1234';
        GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
        ALTER USER cricket_user CREATEDB;
    END IF;
END
\$\$;" || {
    warning "User creation may have failed, continuing..."
}

# Create cricket_scorer database if it doesn't exist
log "Creating cricket_scorer database..."
sudo -u postgres psql -c "
SELECT 'CREATE DATABASE cricket_scorer OWNER cricket_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cricket_scorer')\gexec" || {
    warning "Database creation may have failed, trying alternative method..."
    
    # Alternative method
    sudo -u postgres createdb -O cricket_user cricket_scorer 2>/dev/null || {
        log "Database may already exist, continuing..."
    }
}

# Grant all privileges to cricket_user on the database
log "Setting up database permissions and ownership..."
sudo -u postgres psql -d cricket_scorer -c "
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;" || {
    warning "Some permissions may have failed, continuing..."
}

# Transfer ownership of all existing tables and sequences to cricket_user
log "Transferring table and sequence ownership to cricket_user for drizzle-kit compatibility..."
sudo -u postgres psql -d cricket_scorer << 'EOF'
-- Transfer ownership of all tables
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(rec.tablename) || ' OWNER TO cricket_user;';
        RAISE NOTICE 'Transferred ownership of table %', rec.tablename;
    END LOOP;
END;
$$;

-- Transfer ownership of all sequences
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(rec.sequencename) || ' OWNER TO cricket_user;';
        RAISE NOTICE 'Transferred ownership of sequence %', rec.sequencename;
    END LOOP;
END;
$$;
EOF

if [ $? -eq 0 ]; then
    success "Database ownership transfer completed"
else
    warning "Database ownership transfer had some issues, continuing..."
fi

# Test database connections
log "Testing database connections..."

# Test as postgres user
if sudo -u postgres psql -c "SELECT version();" >/dev/null 2>&1; then
    success "PostgreSQL admin connection works"
else
    error "PostgreSQL admin connection failed"
    exit 1
fi

# Test as cricket_user
if PGPASSWORD=abcd1234 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    success "Cricket user database connection works"
else
    warning "Cricket user connection failed, checking authentication..."
    
    # Check if we need to update pg_hba.conf
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
    if [ -f "$PG_HBA" ]; then
        log "Updating pg_hba.conf for cricket_user access..."
        
        # Backup pg_hba.conf
        cp "$PG_HBA" "${PG_HBA}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Ensure cricket_user has access
        if ! grep -q "cricket_user" "$PG_HBA"; then
            cat >> "$PG_HBA" << 'EOF'

# Cricket Scorer Application Access
local   cricket_scorer  cricket_user                    md5
host    cricket_scorer  cricket_user    127.0.0.1/32   md5
host    cricket_scorer  cricket_user    ::1/128        md5
EOF
            
            log "Restarting PostgreSQL to apply authentication changes..."
            systemctl restart postgresql
            
            # Wait for restart
            sleep 5
            
            # Test again
            if PGPASSWORD=abcd1234 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
                success "Cricket user database connection now works"
            else
                warning "Cricket user connection still failing, but user/database created"
            fi
        fi
    fi
fi

# Show database status
log "Database status summary:"
sudo -u postgres psql -c "
SELECT 
    datname as database,
    datallowconn as allow_connections,
    pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database 
WHERE datname IN ('cricket_scorer', 'postgres')
ORDER BY datname;"

log "User status summary:"
sudo -u postgres psql -c "
SELECT 
    usename as username,
    usesuper as is_superuser,
    usecreatedb as can_create_db,
    useconnlimit as connection_limit
FROM pg_user 
WHERE usename IN ('postgres', 'cricket_user')
ORDER BY usename;"

# Create DATABASE_URL for the application
DATABASE_URL="postgresql://cricket_user:abcd1234@localhost:5432/cricket_scorer"
log "Database URL: $DATABASE_URL"

# Show final ownership status for verification
log "Final ownership verification..."
sudo -u postgres psql -d cricket_scorer -c "
\echo '=== TABLE OWNERSHIP STATUS ==='
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

\echo '=== SEQUENCE OWNERSHIP STATUS ==='
SELECT schemaname, sequencename, sequenceowner 
FROM pg_sequences 
WHERE schemaname = 'public' 
ORDER BY sequencename;" 2>/dev/null || true

success "Database users and schema setup completed!"
log "Database is now ready for drizzle-kit operations"
log "You can now connect using:"
log "  psql -h localhost -U cricket_user -d cricket_scorer"
log "  Password: abcd1234"
log ""
log "Environment variable for application:"
log "  DATABASE_URL=$DATABASE_URL"