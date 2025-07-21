#!/bin/bash

# Fix Database Ownership for Cricket Scorer
# Transfers ownership of all tables to cricket_user for drizzle-kit compatibility

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

log "Fixing database ownership for drizzle-kit compatibility..."

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    error "PostgreSQL is not ready after 30 seconds"
    exit 1
fi

success "PostgreSQL is ready"

# Transfer ownership of all existing tables and sequences to cricket_user
log "Transferring table and sequence ownership to cricket_user..."

psql -U postgres -d cricket_scorer << 'EOF'
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

-- Grant all privileges to cricket_user (in case not already done)
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;

-- Show final ownership status
\echo '=== TABLE OWNERSHIP STATUS ==='
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

\echo '=== SEQUENCE OWNERSHIP STATUS ==='
SELECT schemaname, sequencename, sequenceowner 
FROM pg_sequences 
WHERE schemaname = 'public' 
ORDER BY sequencename;
EOF

if [ $? -eq 0 ]; then
    success "Database ownership transfer completed successfully"
else
    error "Database ownership transfer failed"
    exit 1
fi

# Test database connection as cricket_user
log "Testing database connection as cricket_user..."
if PGPASSWORD=cricket_pass psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT current_user, current_database();" >/dev/null 2>&1; then
    success "Cricket user database connection test passed"
else
    error "Cricket user database connection test failed"
    exit 1
fi

success "Database ownership fix completed!"
log "You can now run: drizzle-kit push"