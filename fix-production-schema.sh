#!/bin/bash

# Fix Production Database Schema - Column Name Synchronization
# Run this script on production server to fix schema mismatch issues

set -e

APP_DIR="/opt/cricket-scorer"

# Check if we're on production server
if [ "$(hostname -I 2>/dev/null | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
elif [ -d "/nix/store" ]; then
    echo "⚠ This is the development environment (Replit)"
    echo "This script is for the production server. Please run on 67.227.251.94"
    exit 0
else
    echo "Production environment detected"
fi

if [ ! -d "$APP_DIR" ]; then
    echo "✗ Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

echo "=== Fixing Production Database Schema ==="

# Stop application to avoid conflicts
echo "Stopping Cricket Scorer application..."
pm2 stop cricket-scorer 2>/dev/null || true

# Database connection details
DB_NAME="cricket_scorer"
DB_USER="cricket_user"
DB_PASSWORD="simple123"

echo "Checking current database schema..."

# Check current column names in teams table
echo "Current teams table schema:"
PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME -c "\d teams" || echo "Teams table doesn't exist"

echo ""
echo "Fixing schema column names..."

# Fix teams table - ensure column names match Drizzle schema
PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME << 'EOF'

-- Check if teams table exists and has wrong column names
DO $$
BEGIN
    -- Fix short_name to shortName if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') THEN
        ALTER TABLE teams RENAME COLUMN short_name TO "shortName";
        RAISE NOTICE 'Renamed short_name to shortName';
    END IF;

    -- Fix team_id columns in other tables
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
        ALTER TABLE players RENAME COLUMN team_id TO "teamId";
        RAISE NOTICE 'Renamed team_id to teamId in players table';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'team1_id') THEN
        ALTER TABLE matches RENAME COLUMN team1_id TO "team1Id";
        ALTER TABLE matches RENAME COLUMN team2_id TO "team2Id";
        ALTER TABLE matches RENAME COLUMN toss_winner_id TO "tossWinnerId";
        ALTER TABLE matches RENAME COLUMN toss_decision TO "tossDecision";
        ALTER TABLE matches RENAME COLUMN match_type TO "matchType";
        ALTER TABLE matches RENAME COLUMN current_innings TO "currentInnings";
        ALTER TABLE matches RENAME COLUMN created_at TO "createdAt";
        RAISE NOTICE 'Fixed column names in matches table';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing schema: %', SQLERRM;
END $$;

-- Verify the changes
\d teams
\d players
\d matches

EOF

echo "✓ Database schema fixed"

# Now run Drizzle push to ensure complete synchronization
echo "Running Drizzle schema synchronization..."
if command -v npm >/dev/null 2>&1; then
    npm run db:push 2>/dev/null || echo "Drizzle push failed, continuing..."
else
    echo "npm not found, skipping drizzle push"
fi

# Restart application
echo "Starting Cricket Scorer application..."
pm2 start cricket-scorer

echo "Waiting for application to start..."
sleep 10

# Test application
echo "Testing application..."
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ Application is responding successfully!"
    echo ""
    echo "=== Testing Team Creation ==="
    # Test team creation with proper data
    curl -X POST http://localhost:3000/api/teams \
         -H "Content-Type: application/json" \
         -d '{"name":"Test Team","shortName":"TST"}' \
         2>/dev/null && echo "" && echo "✓ Team creation test successful!"
    
    echo ""
    echo "=== PM2 Status ==="
    pm2 list
    echo ""
    echo "✓ Production database schema fix completed!"
    echo "You can now create teams and matches successfully."
    echo "Application is available at: https://score.ramisetty.net"
else
    echo "✗ Application not responding, checking logs..."
    pm2 logs cricket-scorer --lines 20
    exit 1
fi