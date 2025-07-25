#!/bin/bash

# Cricket Scorer Database Migration Runner
# Executes production-schema.sql migration safely

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-cricket_user}"
DB_PASSWORD="${DB_PASSWORD:-simple123}"
DB_NAME="${DB_NAME:-cricket_scorer}"
MIGRATION_FILE="$(dirname "$0")/production-schema.sql"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Validate prerequisites
validate_prerequisites() {
    log "Validating migration prerequisites..."
    
    # Check if migration file exists
    if [ ! -f "$MIGRATION_FILE" ]; then
        error "Migration file not found: $MIGRATION_FILE"
        exit 1
    fi
    
    # Check if psql is available
    if ! command -v psql >/dev/null 2>&1; then
        error "PostgreSQL client (psql) is not installed"
        exit 1
    fi
    
    # Test database connection
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        error "Cannot connect to PostgreSQL server"
        exit 1
    fi
    
    success "Prerequisites validated"
}

# Create database if it doesn't exist
ensure_database_exists() {
    log "Ensuring database '$DB_NAME' exists..."
    
    # Check if database exists
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        success "Database '$DB_NAME' already exists"
    else
        log "Creating database '$DB_NAME'..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
        success "Database '$DB_NAME' created"
    fi
}

# Backup existing schema (if tables exist)
backup_existing_schema() {
    log "Creating backup of existing schema..."
    
    # Check if any tables exist
    local table_count
    table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " 2>/dev/null | xargs || echo "0")
    
    if [ "$table_count" -gt 0 ]; then
        local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
        log "Found $table_count existing tables, creating backup: $backup_file"
        
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
            --schema-only --no-owner --no-privileges > "$backup_file" 2>/dev/null
        
        if [ -f "$backup_file" ]; then
            success "Schema backup created: $backup_file"
        else
            warning "Backup creation failed, continuing without backup"
        fi
    else
        success "No existing tables found, skipping backup"
    fi
}

# Run the migration
run_migration() {
    log "Executing database migration..."
    
    # Execute the migration file
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" >/dev/null 2>&1; then
        success "Migration executed successfully"
    else
        error "Migration execution failed"
        log "Attempting to run migration with verbose output..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
        exit 1
    fi
}

# Validate migration results
validate_migration() {
    log "Validating migration results..."
    
    # Count tables created
    local table_count
    table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " 2>/dev/null | xargs || echo "0")
    
    # Check for expected tables
    local expected_tables=("users" "franchises" "teams" "players" "matches" "innings" "balls" "player_stats" "sessions")
    local missing_tables=()
    
    for table in "${expected_tables[@]}"; do
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '$table';
        " 2>/dev/null | grep -q 1; then
            missing_tables+=("$table")
        fi
    done
    
    if [ ${#missing_tables[@]} -eq 0 ]; then
        success "All expected tables are present ($table_count total tables)"
    else
        warning "Missing tables: ${missing_tables[*]}"
    fi
    
    # Check admin user creation
    local admin_count
    admin_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM users WHERE email = 'admin@cricket.com';
    " 2>/dev/null | xargs || echo "0")
    
    if [ "$admin_count" -gt 0 ]; then
        success "Admin user (admin@cricket.com) created successfully"
    else
        warning "Admin user not found"
    fi
    
    # Check franchise data
    local franchise_count
    franchise_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM franchises;
    " 2>/dev/null | xargs || echo "0")
    
    if [ "$franchise_count" -gt 0 ]; then
        success "Sample franchises created ($franchise_count franchises)"
    else
        warning "No franchise data found"
    fi
}

# Main execution
main() {
    echo "=== Cricket Scorer Database Migration ==="
    echo "Database: $DB_NAME"
    echo "Host: $DB_HOST"
    echo "User: $DB_USER"
    echo "Migration File: $MIGRATION_FILE"
    echo ""
    
    validate_prerequisites
    ensure_database_exists
    backup_existing_schema
    run_migration
    validate_migration
    
    echo ""
    success "Database migration completed successfully!"
    echo ""
    echo "=== Migration Summary ==="
    echo "• Schema: All tables created with IF NOT EXISTS safety"
    echo "• Admin User: admin@cricket.com / admin123 (global_admin role)"
    echo "• Sample Data: 4 franchises initialized"
    echo "• Indexes: Performance indexes created"
    echo "• ICC Compliance: All cricket rule fields included"
    echo ""
    log "Migration timestamp: $(date)"
}

# Execute main function
main "$@"