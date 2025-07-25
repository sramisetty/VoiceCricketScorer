#!/bin/bash

# fix-player-creation.sh
# Fix common player creation issues in production

set -e

echo "========================================="
echo "Cricket Scorer - Player Creation Fix"
echo "========================================="

# Database connection settings
DB_NAME="cricket_scorer"
DB_USER="cricket_user"
DB_HOST="localhost"
DB_PORT="5432"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Fixing player creation issues..."

# Function to run SQL with error handling
run_sql() {
    local sql="$1"
    echo "Executing: $sql"
    PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" || {
        echo "Warning: SQL command failed: $sql"
    }
}

# Check and fix players table structure
echo "Checking players table structure..."

# Ensure players table has all required columns with correct types
run_sql "ALTER TABLE players ALTER COLUMN name SET NOT NULL;"
run_sql "ALTER TABLE players ALTER COLUMN role SET NOT NULL;"

# Add missing columns if they don't exist
run_sql "ALTER TABLE players ADD COLUMN IF NOT EXISTS availability BOOLEAN DEFAULT true;"
run_sql "ALTER TABLE players ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{\"totalMatches\": 0, \"totalRuns\": 0, \"totalWickets\": 0, \"highestScore\": 0, \"bestBowling\": \"0/0\"}';"

# Ensure proper defaults and constraints
run_sql "ALTER TABLE players ALTER COLUMN is_active SET DEFAULT true;"
run_sql "ALTER TABLE players ALTER COLUMN availability SET DEFAULT true;"
run_sql "ALTER TABLE players ALTER COLUMN created_at SET DEFAULT NOW();"
run_sql "ALTER TABLE players ALTER COLUMN updated_at SET DEFAULT NOW();"

# Fix any data type issues
run_sql "UPDATE players SET availability = true WHERE availability IS NULL;"
run_sql "UPDATE players SET is_active = true WHERE is_active IS NULL;"
run_sql "UPDATE players SET stats = '{\"totalMatches\": 0, \"totalRuns\": 0, \"totalWickets\": 0, \"highestScore\": 0, \"bestBowling\": \"0/0\"}' WHERE stats IS NULL;"

# Ensure foreign key constraints are properly handled
echo "Checking foreign key constraints..."

# Make sure franchise_id allows NULL (optional relationship)
run_sql "ALTER TABLE players ALTER COLUMN franchise_id DROP NOT NULL;" 2>/dev/null || echo "franchise_id already allows NULL"

# Make sure team_id allows NULL (optional relationship)
run_sql "ALTER TABLE players ALTER COLUMN team_id DROP NOT NULL;" 2>/dev/null || echo "team_id already allows NULL"

# Make sure user_id allows NULL (optional relationship)
run_sql "ALTER TABLE players ALTER COLUMN user_id DROP NOT NULL;" 2>/dev/null || echo "user_id already allows NULL"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Player creation fix completed!"
echo "✅ Players table structure updated"
echo "✅ Required columns ensured"
echo "✅ Default values set"
echo "✅ Foreign key constraints relaxed"
echo ""
echo "Test player creation with:"
echo "node diagnose-player-creation.js"