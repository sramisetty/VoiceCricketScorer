#!/bin/bash

# clean-database-schema.sh
# Complete database schema cleanup script for Cricket Scorer
# Run this BEFORE deploy-cricket-scorer.sh to eliminate all schema conflicts

set -e

echo "=========================================="
echo "Cricket Scorer - Complete Schema Cleanup"
echo "=========================================="
echo "WARNING: This will DELETE ALL existing data!"
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10

# Database connection settings
DB_NAME="cricket_scorer"
DB_USER="cricket_user"
DB_HOST="localhost"
DB_PORT="5432"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting complete schema cleanup..."

# Function to run SQL with error handling
run_sql() {
    local sql="$1"
    echo "Executing: $sql"
    PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" || {
        echo "Warning: SQL command failed (this may be expected if object doesn't exist)"
    }
}

# Drop all tables in dependency order (foreign keys first)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping all tables..."

# Drop tables with foreign key dependencies first
run_sql "DROP TABLE IF EXISTS balls CASCADE;"
run_sql "DROP TABLE IF EXISTS player_stats CASCADE;"
run_sql "DROP TABLE IF EXISTS player_franchise_links CASCADE;"
run_sql "DROP TABLE IF EXISTS innings CASCADE;"
run_sql "DROP TABLE IF EXISTS matches CASCADE;"
run_sql "DROP TABLE IF EXISTS players CASCADE;"
run_sql "DROP TABLE IF EXISTS teams CASCADE;"
run_sql "DROP TABLE IF EXISTS franchises CASCADE;"
run_sql "DROP TABLE IF EXISTS users CASCADE;"
run_sql "DROP TABLE IF EXISTS sessions CASCADE;"

# Drop any remaining tables that might exist
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping any remaining objects..."

# Drop all sequences
run_sql "DROP SEQUENCE IF EXISTS balls_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS player_stats_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS player_franchise_links_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS innings_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS matches_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS players_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS teams_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS franchises_id_seq CASCADE;"
run_sql "DROP SEQUENCE IF EXISTS users_id_seq CASCADE;"

# Drop any custom types or functions if they exist
run_sql "DROP TYPE IF EXISTS user_role CASCADE;"
run_sql "DROP TYPE IF EXISTS player_role CASCADE;"
run_sql "DROP TYPE IF EXISTS match_status CASCADE;"
run_sql "DROP TYPE IF EXISTS dismissal_type CASCADE;"

# Verify cleanup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying cleanup..."
TABLE_COUNT=$(PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | tr -d ' ')

echo "Remaining tables in public schema: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq "0" ]; then
    echo "✅ Schema cleanup completed successfully!"
    echo "✅ All tables, sequences, and objects removed"
    echo "✅ Database is now ready for fresh deployment"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./deploy-cricket-scorer.sh"
    echo "2. The deployment script will create fresh schema"
else
    echo "⚠️  Warning: $TABLE_COUNT tables still remain"
    echo "Manual cleanup may be required"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Schema cleanup completed."
echo "=========================================="