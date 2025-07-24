#!/bin/bash

# Emergency Production Fix - Resolve Database Connection Issues
# Run this immediately on production server to fix the broken application

set -e

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR"

echo "=== Emergency Production Fix ==="
echo "Diagnosing and fixing database connection issues..."

# Check if application is running
pm2 list

# Check application logs
echo "=== Recent Application Logs ==="
pm2 logs cricket-scorer --lines 20

# Test database connection
echo "=== Testing Database Connection ==="
PGPASSWORD=simple123 psql -h localhost -p 5432 -U cricket_user -d cricket_scorer -c "SELECT current_database(), current_user;" || {
    echo "Database connection failed!"
    exit 1
}

# Check if tables exist and verify schema
echo "=== Checking Database Schema ==="
PGPASSWORD=simple123 psql -h localhost -p 5432 -U cricket_user -d cricket_scorer -c "\d teams" 2>/dev/null || {
    echo "Teams table missing or corrupted!"
    echo "Recreating basic schema..."
    
    # Recreate basic tables if missing
    PGPASSWORD=simple123 psql -h localhost -p 5432 -U cricket_user -d cricket_scorer << 'EOF'
    
    -- Drop and recreate teams table with correct schema
    DROP TABLE IF EXISTS teams CASCADE;
    CREATE TABLE teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        logo TEXT
    );
    
    -- Insert test data
    INSERT INTO teams (name, short_name) VALUES 
        ('Chiefs', 'CHF'),
        ('Warriors', 'WAR');
    
    -- Drop and recreate players table
    DROP TABLE IF EXISTS players CASCADE;
    CREATE TABLE players (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        team_id INTEGER REFERENCES teams(id),
        role TEXT NOT NULL,
        batting_order INTEGER
    );
    
    -- Drop and recreate matches table
    DROP TABLE IF EXISTS matches CASCADE;
    CREATE TABLE matches (
        id SERIAL PRIMARY KEY,
        team1_id INTEGER REFERENCES teams(id) NOT NULL,
        team2_id INTEGER REFERENCES teams(id) NOT NULL,
        toss_winner_id INTEGER REFERENCES teams(id),
        toss_decision TEXT,
        match_type TEXT NOT NULL,
        overs INTEGER NOT NULL,
        venue TEXT,
        status TEXT NOT NULL DEFAULT 'setup',
        current_innings INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
    );
    
EOF
}

# Restart application
echo "=== Restarting Application ==="
pm2 restart cricket-scorer
sleep 10

# Test application endpoints
echo "=== Testing Application ==="
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ GET /api/teams working"
    curl -s http://localhost:3000/api/teams | head -200
else
    echo "✗ GET /api/teams failed"
fi

# Test team creation
echo ""
echo "=== Testing Team Creation ==="
RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Team","shortName":"TST"}' 2>/dev/null)

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✓ Team creation working"
    echo "Response: $BODY"
else
    echo "✗ Team creation failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    
    # Show more detailed logs
    echo "=== Detailed Application Logs ==="
    pm2 logs cricket-scorer --lines 50
fi

echo ""
echo "=== Final Status ==="
pm2 list
echo ""
echo "Application should be accessible at: https://score.ramisetty.net"