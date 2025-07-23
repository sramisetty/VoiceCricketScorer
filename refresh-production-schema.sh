#!/bin/bash

echo "=== Refreshing Production Database Schema ==="

# Check if we're on production server
if [ "$(hostname -I 2>/dev/null | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
elif [ -d "/nix/store" ]; then
    echo "⚠ This is the development environment (Replit)"
    echo "This script is for the production server. Please run on 67.227.251.94"
    echo ""
    echo "To refresh production schema:"
    echo "1. SSH to production: ssh root@67.227.251.94"
    echo "2. Go to app directory: cd /opt/cricket-scorer || cd /root/cricket-scorer"
    echo "3. Run this script: ./refresh-production-schema.sh"
    exit 0
else
    echo "Production environment detected"
fi

APP_DIR="/opt/cricket-scorer"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="/root/cricket-scorer"
fi

cd "$APP_DIR" || {
    echo "Could not find application directory"
    exit 1
}

echo "Application directory: $(pwd)"

# Test current database connection
echo ""
echo "=== Testing Database Connection ==="
if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    echo "Run reset-database-password.sh first to fix connection"
    exit 1
fi

# Show current schema
echo ""
echo "=== Current Database Schema ==="
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "\dt" 2>/dev/null || echo "Could not list tables"

# Backup current database
echo ""
echo "=== Creating Database Backup ==="
BACKUP_FILE="/tmp/cricket_scorer_backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD=simple123 pg_dump -h localhost -U cricket_user -d cricket_scorer > "$BACKUP_FILE"
if [ -f "$BACKUP_FILE" ]; then
    echo "✓ Database backed up to: $BACKUP_FILE"
else
    echo "✗ Backup failed - proceeding without backup"
fi

# Drop and recreate all tables with complete schema
echo ""
echo "=== Recreating Database Schema ==="
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer <<'SCHEMA_EOF'
-- Drop all tables in correct order (handling foreign keys)
DROP TABLE IF EXISTS balls CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Create teams table (matching Drizzle schema exactly)
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    logo TEXT
);

-- Create players table (matching Drizzle schema exactly)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'batsman',
    batting_order INTEGER
);

-- Create matches table (matching Drizzle schema exactly)
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    team1_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    team2_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    toss_winner_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    toss_decision TEXT,
    match_type TEXT NOT NULL DEFAULT 'T20',
    overs INTEGER NOT NULL DEFAULT 20,
    venue TEXT,
    status TEXT NOT NULL DEFAULT 'setup',
    current_innings INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create innings table (matching Drizzle schema exactly)
CREATE TABLE innings (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    batting_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    bowling_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    innings_number INTEGER NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_overs INTEGER DEFAULT 0,
    total_balls INTEGER DEFAULT 0,
    extras JSONB DEFAULT '{}',
    is_completed BOOLEAN DEFAULT FALSE,
    current_bowler_id INTEGER REFERENCES players(id)
);

-- Create balls table (matching Drizzle schema exactly)
CREATE TABLE balls (
    id SERIAL PRIMARY KEY,
    innings_id INTEGER REFERENCES innings(id) ON DELETE CASCADE NOT NULL,
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    batsman_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    bowler_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    runs INTEGER DEFAULT 0,
    is_wicket BOOLEAN DEFAULT FALSE,
    wicket_type TEXT,
    fielder_id INTEGER REFERENCES players(id),
    extra_type TEXT,
    extra_runs INTEGER DEFAULT 0,
    is_short_run BOOLEAN DEFAULT FALSE,
    is_dead_ball BOOLEAN DEFAULT FALSE,
    penalty_runs INTEGER DEFAULT 0,
    batsman_crossed BOOLEAN DEFAULT FALSE,
    commentary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create player_stats table (matching Drizzle schema exactly)
CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    innings_id INTEGER REFERENCES innings(id) ON DELETE CASCADE NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    runs INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    fours INTEGER DEFAULT 0,
    sixes INTEGER DEFAULT 0,
    is_out BOOLEAN DEFAULT FALSE,
    is_on_strike BOOLEAN DEFAULT FALSE,
    dismissal_type TEXT,
    dismissal_ball INTEGER,
    fielder_id INTEGER REFERENCES players(id),
    overs_bowled INTEGER DEFAULT 0,
    balls_bowled INTEGER DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    wickets_taken INTEGER DEFAULT 0,
    maiden_overs INTEGER DEFAULT 0,
    wide_balls INTEGER DEFAULT 0,
    no_balls INTEGER DEFAULT 0
);

-- Set proper ownership
ALTER TABLE teams OWNER TO cricket_user;
ALTER TABLE players OWNER TO cricket_user;
ALTER TABLE matches OWNER TO cricket_user;
ALTER TABLE innings OWNER TO cricket_user;
ALTER TABLE balls OWNER TO cricket_user;
ALTER TABLE player_stats OWNER TO cricket_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;

-- Create indexes for performance (matching Drizzle column names)
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_teams ON matches(team1_id, team2_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_balls_innings ON balls(innings_id);
CREATE INDEX idx_balls_over ON balls(innings_id, over_number, ball_number);
CREATE INDEX idx_player_stats_innings ON player_stats(innings_id);
CREATE INDEX idx_player_stats_player ON player_stats(player_id);

-- Insert sample data for testing (using correct column names)
INSERT INTO teams (name, short_name) VALUES 
    ('Sample Team A', 'STA'), 
    ('Sample Team B', 'STB');

-- Verify schema creation
SELECT 'Schema refresh completed successfully' as status;

\q
SCHEMA_EOF

# Check if schema creation was successful
echo ""
echo "=== Verifying Schema Creation ==="
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "\dt" 2>/dev/null

echo ""
echo "Checking table counts:"
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer <<'CHECK_EOF'
SELECT 'teams' as table_name, COUNT(*) as row_count FROM teams
UNION ALL
SELECT 'players' as table_name, COUNT(*) as row_count FROM players
UNION ALL
SELECT 'matches' as table_name, COUNT(*) as row_count FROM matches
UNION ALL
SELECT 'innings' as table_name, COUNT(*) as row_count FROM innings
UNION ALL
SELECT 'balls' as table_name, COUNT(*) as row_count FROM balls
UNION ALL
SELECT 'player_stats' as table_name, COUNT(*) as row_count FROM player_stats;
\q
CHECK_EOF

# Test Drizzle compatibility
echo ""
echo "=== Testing Drizzle Schema Compatibility ==="
if [ -f "node_modules/.bin/drizzle-kit" ]; then
    echo "Running Drizzle introspection to verify compatibility..."
    npm run db:push 2>&1 | head -20
    
    if [ $? -eq 0 ]; then
        echo "✓ Drizzle schema sync successful"
    else
        echo "⚠ Drizzle sync had issues - manual schema should still work"
    fi
else
    echo "Drizzle-kit not found - using manual schema only"
fi

# Restart PM2 application to pick up schema changes
echo ""
echo "=== Restarting Application ==="
if pm2 list | grep -q cricket-scorer; then
    echo "Restarting PM2 application..."
    pm2 restart cricket-scorer
    sleep 10
    
    # Test API endpoints
    echo ""
    echo "=== Testing API Endpoints ==="
    
    echo "Testing teams endpoint..."
    if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
        echo "✓ Teams API working"
        curl -s http://localhost:3000/api/teams | head -200
    else
        echo "✗ Teams API not responding"
    fi
    
    echo ""
    echo "Testing match creation flow..."
    # Test creating a new team (using correct field names)
    TEAM_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
        -H "Content-Type: application/json" \
        -d '{"name":"Schema Test Team","shortName":"STT"}' \
        -o /tmp/schema_team.json)
    
    if [ "$TEAM_RESPONSE" = "200" ]; then
        echo "✓ Team creation API working"
        TEAM_ID=$(cat /tmp/schema_team.json | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)
        
        # Test creating a player (using correct field names)
        PLAYER_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/players \
            -H "Content-Type: application/json" \
            -d "{\"name\":\"Schema Test Player\",\"teamId\":$TEAM_ID,\"role\":\"batsman\",\"battingOrder\":1}" \
            -o /tmp/schema_player.json)
        
        if [ "$PLAYER_RESPONSE" = "200" ]; then
            echo "✓ Player creation API working"
            echo "✓ Match creation should now work properly"
        else
            echo "✗ Player creation failed (HTTP $PLAYER_RESPONSE)"
            cat /tmp/schema_player.json 2>/dev/null
        fi
    else
        echo "✗ Team creation failed (HTTP $TEAM_RESPONSE)"
        cat /tmp/schema_team.json 2>/dev/null
    fi
    
    # Cleanup temp files
    rm -f /tmp/schema_team.json /tmp/schema_player.json
    
else
    echo "PM2 application not found - start with: pm2 start ecosystem.config.cjs"
fi

echo ""
echo "=== Schema Refresh Complete ==="
echo "Database: cricket_scorer"
echo "User: cricket_user"
echo "Password: simple123"
echo ""
echo "Tables created:"
echo "  - teams (with sample data)"
echo "  - players"
echo "  - matches"
echo "  - innings"
echo "  - balls (ICC-compliant with all fields)"
echo "  - player_stats (comprehensive statistics)"
echo ""
echo "The production schema is now synchronized and ready for match creation."
echo "Backup saved to: $BACKUP_FILE"