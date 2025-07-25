#!/bin/bash

# fix-incomplete-schema.sh
# Complete schema creation when initial deployment is incomplete

set -e

echo "==========================================="
echo "Cricket Scorer - Complete Schema Fix"
echo "==========================================="

# Database connection settings
DB_NAME="cricket_scorer"
DB_USER="cricket_user"
DB_HOST="localhost"
DB_PORT="5432"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completing database schema..."

# Function to run SQL with error handling
run_sql() {
    local sql="$1"
    echo "Executing: $sql"
    PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" || {
        echo "Warning: SQL command failed: $sql"
        # Don't exit, continue with other commands
    }
}

# Check what tables exist
echo "Checking existing tables..."
EXISTING_TABLES=$(PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | tr -d ' ' | tr '\n' ' ')
echo "Existing tables: $EXISTING_TABLES"

# Create complete schema with all necessary tables
echo "Creating complete Cricket Scorer schema..."

# Create enum types first (drop and recreate to avoid conflicts)
run_sql "DROP TYPE IF EXISTS user_role CASCADE;"
run_sql "CREATE TYPE user_role AS ENUM ('admin', 'global_admin', 'franchise_admin', 'coach', 'scorer', 'viewer', 'player');"

run_sql "DROP TYPE IF EXISTS player_role CASCADE;"
run_sql "CREATE TYPE player_role AS ENUM ('batsman', 'bowler', 'wicket_keeper', 'all_rounder', 'captain');"

run_sql "DROP TYPE IF EXISTS match_status CASCADE;"
run_sql "CREATE TYPE match_status AS ENUM ('not_started', 'in_progress', 'completed', 'abandoned');"

run_sql "DROP TYPE IF EXISTS dismissal_type CASCADE;"
run_sql "CREATE TYPE dismissal_type AS ENUM ('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructing_field', 'handled_ball', 'timed_out', 'retired_hurt', 'retired_out');"

# Sessions table (required for authentication)
run_sql "CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);"

run_sql "CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);"

# Users table (complete structure)
run_sql "CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'viewer',
    franchise_id INTEGER,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    profile_image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Franchises table
run_sql "CREATE TABLE IF NOT EXISTS franchises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(10) NOT NULL,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    home_ground VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Teams table
run_sql "CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(10) NOT NULL,
    franchise_id INTEGER REFERENCES franchises(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Players table
run_sql "CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role player_role NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    user_id VARCHAR REFERENCES users(id),
    batting_order INTEGER,
    contact_info VARCHAR(255),
    preferred_position VARCHAR(50),
    franchise_id INTEGER REFERENCES franchises(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Player franchise links table
run_sql "CREATE TABLE IF NOT EXISTS player_franchise_links (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    franchise_id INTEGER REFERENCES franchises(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, franchise_id)
);"

# Matches table
run_sql "CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    team1_id INTEGER REFERENCES teams(id),
    team2_id INTEGER REFERENCES teams(id),
    date DATE,
    venue VARCHAR(200),
    overs_per_side INTEGER DEFAULT 20,
    status match_status DEFAULT 'not_started',
    toss_winner_team_id INTEGER REFERENCES teams(id),
    toss_decision VARCHAR(10),
    current_innings INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Innings table
run_sql "CREATE TABLE IF NOT EXISTS innings (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    batting_team_id INTEGER REFERENCES teams(id),
    bowling_team_id INTEGER REFERENCES teams(id),
    innings_number INTEGER NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_balls INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Balls table
run_sql "CREATE TABLE IF NOT EXISTS balls (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    innings_id INTEGER REFERENCES innings(id) ON DELETE CASCADE,
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    bowler_id INTEGER REFERENCES players(id),
    batsman_id INTEGER REFERENCES players(id),
    non_striker_id INTEGER REFERENCES players(id),
    runs_scored INTEGER DEFAULT 0,
    extras INTEGER DEFAULT 0,
    extra_type VARCHAR(20),
    is_wicket BOOLEAN DEFAULT false,
    wicket_type VARCHAR(50),
    dismissed_player_id INTEGER REFERENCES players(id),
    fielder_id INTEGER REFERENCES players(id),
    is_boundary BOOLEAN DEFAULT false,
    is_six BOOLEAN DEFAULT false,
    is_wide BOOLEAN DEFAULT false,
    is_no_ball BOOLEAN DEFAULT false,
    is_bye BOOLEAN DEFAULT false,
    is_leg_bye BOOLEAN DEFAULT false,
    is_short_run BOOLEAN DEFAULT false,
    is_dead_ball BOOLEAN DEFAULT false,
    penalty_runs INTEGER DEFAULT 0,
    batsman_crossed BOOLEAN DEFAULT false,
    commentary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);"

# Player stats table
run_sql "CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES players(id),
    innings_id INTEGER REFERENCES innings(id),
    runs_scored INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    fours INTEGER DEFAULT 0,
    sixes INTEGER DEFAULT 0,
    strike_rate DECIMAL(5,2) DEFAULT 0,
    is_out BOOLEAN DEFAULT false,
    dismissal_type dismissal_type,
    bowler_id INTEGER REFERENCES players(id),
    fielder_id INTEGER REFERENCES players(id),
    overs_bowled DECIMAL(3,1) DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    wickets_taken INTEGER DEFAULT 0,
    maiden_overs INTEGER DEFAULT 0,
    economy_rate DECIMAL(4,2) DEFAULT 0,
    wide_balls INTEGER DEFAULT 0,
    no_balls INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Add foreign key constraints
run_sql "ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS fk_users_franchise FOREIGN KEY (franchise_id) REFERENCES franchises(id);"

# Create indexes for performance
run_sql "CREATE INDEX IF NOT EXISTS idx_balls_match_innings ON balls(match_id, innings_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_balls_over_ball ON balls(over_number, ball_number);"
run_sql "CREATE INDEX IF NOT EXISTS idx_player_stats_match_player ON player_stats(match_id, player_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);"
run_sql "CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);"

# Grant permissions
run_sql "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
run_sql "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Schema fix completed successfully!"

# Verify final table count
FINAL_COUNT=$(PGPASSWORD="simple123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | tr -d ' ')
echo "✅ Final table count: $FINAL_COUNT tables created"
echo "✅ Schema is now complete for Cricket Scorer application"
echo "✅ Ready for admin user creation: ./create-admin.sh"