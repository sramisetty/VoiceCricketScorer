#!/bin/bash

# Quick Production Fix - Combines OpenAI Key + Schema Fix
# This script fixes both the OpenAI API key issue and database schema mismatch

set -e

OPENAI_KEY="$1"

if [ -z "$OPENAI_KEY" ]; then
    echo "Usage: $0 <OPENAI_API_KEY>"
    echo "Example: $0 sk-proj-1234567890abcdef..."
    exit 1
fi

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR"

echo "=== Quick Production Fix ==="
echo "1. Setting OpenAI API Key"
echo "2. Fixing Database Schema"
echo "3. Restarting Application"
echo ""

# Stop application
pm2 stop cricket-scorer 2>/dev/null || true

# Update environment files
cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
OPENAI_API_KEY=$OPENAI_KEY
NODE_ENV=production
PORT=3000
EOF

# Update PM2 config
cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer',
      OPENAI_API_KEY: '$OPENAI_KEY'
    },
    error_file: '/var/log/cricket-scorer-error.log',
    out_file: '/var/log/cricket-scorer-out.log',
    log_file: '/var/log/cricket-scorer.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100
  }]
};
EOF

echo "✓ OpenAI API key configured"

# Fix database schema
echo "Fixing database schema..."
PGPASSWORD=simple123 psql -h localhost -p 5432 -U cricket_user -d cricket_scorer << 'EOF'
-- Fix column names to match Drizzle schema expectations
DO $$
BEGIN
    -- Fix teams table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') THEN
        ALTER TABLE teams RENAME COLUMN short_name TO "shortName";
    END IF;

    -- Fix players table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
        ALTER TABLE players RENAME COLUMN team_id TO "teamId";
        ALTER TABLE players RENAME COLUMN batting_order TO "battingOrder";
    END IF;

    -- Fix matches table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'team1_id') THEN
        ALTER TABLE matches RENAME COLUMN team1_id TO "team1Id";
        ALTER TABLE matches RENAME COLUMN team2_id TO "team2Id";
        ALTER TABLE matches RENAME COLUMN toss_winner_id TO "tossWinnerId";
        ALTER TABLE matches RENAME COLUMN toss_decision TO "tossDecision";
        ALTER TABLE matches RENAME COLUMN match_type TO "matchType";
        ALTER TABLE matches RENAME COLUMN current_innings TO "currentInnings";
        ALTER TABLE matches RENAME COLUMN created_at TO "createdAt";
    END IF;

END $$;
EOF

echo "✓ Database schema fixed"

# Start application
pm2 start cricket-scorer
sleep 10

# Test
if curl -f -s http://localhost:3000/api/teams >/dev/null; then
    echo "✓ Application working!"
    echo ""
    echo "Test team creation:"
    curl -X POST http://localhost:3000/api/teams \
         -H "Content-Type: application/json" \
         -d '{"name":"Test Team","shortName":"TST"}' && echo ""
    echo ""
    echo "✓ Production fix completed successfully!"
    echo "Application available at: https://score.ramisetty.net"
else
    echo "✗ Application not responding"
    pm2 logs cricket-scorer --lines 10
    exit 1
fi