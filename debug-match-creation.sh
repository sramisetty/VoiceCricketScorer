#!/bin/bash

# Debug script for match creation issues in production
echo "=== Cricket Scorer Match Creation Debug ==="

# Check if on production server
if [ "$(hostname -I | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
else
    echo "ℹ This appears to be development environment"
    echo "Run this script on production server: 67.227.251.94"
    exit 0
fi

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR" 2>/dev/null || cd "/root/cricket-scorer" 2>/dev/null || {
    echo "✗ Could not find application directory"
    exit 1
}

echo "Application directory: $(pwd)"

# Load environment variables
if [ -f ".env" ]; then
    echo "✓ Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs) 2>/dev/null || true
else
    echo "✗ No .env file found"
fi

echo ""
echo "=== Environment Check ==="
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:8}..."

echo ""
echo "=== Database Schema Check ==="
if command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
    echo "Testing database connection..."
    if psql "$DATABASE_URL" -c "\dt" >/dev/null 2>&1; then
        echo "✓ Database connection successful"
        
        echo ""
        echo "=== Database Tables ==="
        psql "$DATABASE_URL" -c "\dt"
        
        echo ""
        echo "=== Table Schemas ==="
        echo "Teams table:"
        psql "$DATABASE_URL" -c "\d teams"
        
        echo ""
        echo "Players table:"
        psql "$DATABASE_URL" -c "\d players"
        
        echo ""
        echo "=== Current Data ==="
        echo "Teams count: $(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM teams;" | xargs)"
        echo "Players count: $(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM players;" | xargs)"
        
        echo ""
        echo "Recent teams:"
        psql "$DATABASE_URL" -c "SELECT id, name, \"shortName\" FROM teams ORDER BY id DESC LIMIT 5;"
        
    else
        echo "✗ Database connection failed"
        echo "Database URL: $DATABASE_URL"
    fi
else
    echo "✗ psql not available or DATABASE_URL not set"
fi

echo ""
echo "=== Application Status ==="
if pm2 list | grep -q cricket-scorer; then
    echo "✓ PM2 process running"
    pm2 status cricket-scorer
    
    echo ""
    echo "=== Recent Application Logs ==="
    pm2 logs cricket-scorer --lines 20
else
    echo "✗ PM2 process not running"
fi

echo ""
echo "=== API Test Sequence (Match Creation Flow) ==="

echo "1. Testing Teams API..."
TEAM1_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
    -H "Content-Type: application/json" \
    -d '{"name":"Debug Team 1","shortName":"DBG1"}' \
    -o /tmp/team1.json)

if [ "$TEAM1_RESPONSE" = "200" ]; then
    echo "✓ Team 1 created successfully"
    TEAM1_ID=$(cat /tmp/team1.json | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "Team 1 ID: $TEAM1_ID"
else
    echo "✗ Team 1 creation failed (HTTP $TEAM1_RESPONSE)"
    cat /tmp/team1.json
    exit 1
fi

TEAM2_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
    -H "Content-Type: application/json" \
    -d '{"name":"Debug Team 2","shortName":"DBG2"}' \
    -o /tmp/team2.json)

if [ "$TEAM2_RESPONSE" = "200" ]; then
    echo "✓ Team 2 created successfully"
    TEAM2_ID=$(cat /tmp/team2.json | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "Team 2 ID: $TEAM2_ID"
else
    echo "✗ Team 2 creation failed (HTTP $TEAM2_RESPONSE)"
    cat /tmp/team2.json
    exit 1
fi

echo ""
echo "2. Testing Players API..."
# Create 11 players for team 1
SUCCESS_COUNT=0
for i in {1..11}; do
    PLAYER_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/players \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Player T1-$i\",\"teamId\":$TEAM1_ID,\"role\":\"batsman\",\"battingOrder\":$i}" \
        -o /tmp/player_t1_$i.json)
    
    if [ "$PLAYER_RESPONSE" = "200" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "✗ Player T1-$i creation failed (HTTP $PLAYER_RESPONSE)"
        cat /tmp/player_t1_$i.json
    fi
done

echo "✓ Team 1 players created: $SUCCESS_COUNT/11"

# Create 11 players for team 2
SUCCESS_COUNT=0
for i in {1..11}; do
    PLAYER_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/players \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Player T2-$i\",\"teamId\":$TEAM2_ID,\"role\":\"batsman\",\"battingOrder\":$i}" \
        -o /tmp/player_t2_$i.json)
    
    if [ "$PLAYER_RESPONSE" = "200" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "✗ Player T2-$i creation failed (HTTP $PLAYER_RESPONSE)"
        cat /tmp/player_t2_$i.json
    fi
done

echo "✓ Team 2 players created: $SUCCESS_COUNT/11"

echo ""
echo "3. Testing Match Creation..."
MATCH_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/matches \
    -H "Content-Type: application/json" \
    -d "{\"team1Id\":$TEAM1_ID,\"team2Id\":$TEAM2_ID,\"tossWinnerId\":$TEAM1_ID,\"tossDecision\":\"bat\",\"matchType\":\"T20\",\"overs\":20,\"status\":\"setup\"}" \
    -o /tmp/match.json)

if [ "$MATCH_RESPONSE" = "200" ]; then
    echo "✓ Match created successfully"
    cat /tmp/match.json | head -1
else
    echo "✗ Match creation failed (HTTP $MATCH_RESPONSE)"
    cat /tmp/match.json
fi

echo ""
echo "=== Summary ==="
echo "If all steps passed, the match creation should work in the UI."
echo "If any step failed, that's the root cause of the issue."

# Cleanup temp files
rm -f /tmp/team*.json /tmp/player*.json /tmp/match.json