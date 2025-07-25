-- Cricket Scorer Production Database Migration
-- Version: 2025.01.25
-- Purpose: Complete schema creation and data initialization for production deployment
-- Safe for multiple runs with IF NOT EXISTS checks

-- Enable UUID extension for user IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SESSION STORAGE TABLE (Required for Replit Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Create index on expire column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IDX_session_expire') THEN
        CREATE INDEX IDX_session_expire ON sessions(expire);
    END IF;
END $$;

-- =============================================================================
-- USERS TABLE (Required for Replit Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    role VARCHAR DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to users table
DO $$ 
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'viewer';
    END IF;
END $$;

-- =============================================================================
-- FRANCHISES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS franchises (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    short_name VARCHAR,
    logo_url VARCHAR,
    primary_color VARCHAR,
    secondary_color VARCHAR,
    established_year INTEGER,
    home_ground VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to franchises table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'short_name') THEN
        ALTER TABLE franchises ADD COLUMN short_name VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'logo_url') THEN
        ALTER TABLE franchises ADD COLUMN logo_url VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'primary_color') THEN
        ALTER TABLE franchises ADD COLUMN primary_color VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'secondary_color') THEN
        ALTER TABLE franchises ADD COLUMN secondary_color VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'established_year') THEN
        ALTER TABLE franchises ADD COLUMN established_year INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'home_ground') THEN
        ALTER TABLE franchises ADD COLUMN home_ground VARCHAR;
    END IF;
END $$;

-- =============================================================================
-- TEAMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    short_name VARCHAR,
    franchise_id INTEGER REFERENCES franchises(id),
    logo_url VARCHAR,
    primary_color VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add team_id column if missing and update existing data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') THEN
        ALTER TABLE teams ADD COLUMN short_name VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'logo_url') THEN
        ALTER TABLE teams ADD COLUMN logo_url VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'primary_color') THEN
        ALTER TABLE teams ADD COLUMN primary_color VARCHAR;
    END IF;
END $$;

-- =============================================================================
-- PLAYERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'batsman',
    jersey_number INTEGER,
    batting_style VARCHAR,
    bowling_style VARCHAR,
    is_wicket_keeper BOOLEAN DEFAULT false,
    date_of_birth DATE,
    nationality VARCHAR,
    matches_played INTEGER DEFAULT 0,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to players table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'jersey_number') THEN
        ALTER TABLE players ADD COLUMN jersey_number INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'batting_style') THEN
        ALTER TABLE players ADD COLUMN batting_style VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'bowling_style') THEN
        ALTER TABLE players ADD COLUMN bowling_style VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'is_wicket_keeper') THEN
        ALTER TABLE players ADD COLUMN is_wicket_keeper BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'date_of_birth') THEN
        ALTER TABLE players ADD COLUMN date_of_birth DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'nationality') THEN
        ALTER TABLE players ADD COLUMN nationality VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'matches_played') THEN
        ALTER TABLE players ADD COLUMN matches_played INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_runs') THEN
        ALTER TABLE players ADD COLUMN total_runs INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'total_wickets') THEN
        ALTER TABLE players ADD COLUMN total_wickets INTEGER DEFAULT 0;
    END IF;
END $$;

-- =============================================================================
-- USER-PLAYER LINKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_player_links (
    user_id VARCHAR REFERENCES users(id),
    player_id INTEGER REFERENCES players(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, player_id)
);

-- =============================================================================
-- PLAYER-FRANCHISE LINKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS player_franchise_links (
    player_id INTEGER REFERENCES players(id),
    franchise_id INTEGER REFERENCES franchises(id),
    is_active BOOLEAN DEFAULT true,
    contract_start DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (player_id, franchise_id)
);

-- Add missing columns to player_franchise_links table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_franchise_links' AND column_name = 'contract_start') THEN
        ALTER TABLE player_franchise_links ADD COLUMN contract_start DATE;
    END IF;
END $$;

-- =============================================================================
-- MATCHES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    team1_id INTEGER REFERENCES teams(id),
    team2_id INTEGER REFERENCES teams(id),
    toss_winner_team_id INTEGER REFERENCES teams(id),
    toss_decision VARCHAR,
    batting_team_id INTEGER REFERENCES teams(id),
    bowling_team_id INTEGER REFERENCES teams(id),
    current_innings INTEGER DEFAULT 1,
    status VARCHAR DEFAULT 'not_started',
    match_type VARCHAR DEFAULT 'T20',
    overs_per_innings INTEGER DEFAULT 20,
    venue VARCHAR,
    match_date DATE,
    created_by VARCHAR REFERENCES users(id),
    winner_team_id INTEGER REFERENCES teams(id),
    margin_runs INTEGER,
    margin_wickets INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to matches table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'toss_winner_team_id') THEN
        ALTER TABLE matches ADD COLUMN toss_winner_team_id INTEGER REFERENCES teams(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'toss_decision') THEN
        ALTER TABLE matches ADD COLUMN toss_decision VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'batting_team_id') THEN
        ALTER TABLE matches ADD COLUMN batting_team_id INTEGER REFERENCES teams(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'bowling_team_id') THEN
        ALTER TABLE matches ADD COLUMN bowling_team_id INTEGER REFERENCES teams(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'current_innings') THEN
        ALTER TABLE matches ADD COLUMN current_innings INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'match_type') THEN
        ALTER TABLE matches ADD COLUMN match_type VARCHAR DEFAULT 'T20';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'overs_per_innings') THEN
        ALTER TABLE matches ADD COLUMN overs_per_innings INTEGER DEFAULT 20;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'venue') THEN
        ALTER TABLE matches ADD COLUMN venue VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'match_date') THEN
        ALTER TABLE matches ADD COLUMN match_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'created_by') THEN
        ALTER TABLE matches ADD COLUMN created_by VARCHAR REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'winner_team_id') THEN
        ALTER TABLE matches ADD COLUMN winner_team_id INTEGER REFERENCES teams(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'margin_runs') THEN
        ALTER TABLE matches ADD COLUMN margin_runs INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'margin_wickets') THEN
        ALTER TABLE matches ADD COLUMN margin_wickets INTEGER;
    END IF;
END $$;

-- =============================================================================
-- INNINGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS innings (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    innings_number INTEGER NOT NULL,
    batting_team_id INTEGER REFERENCES teams(id),
    bowling_team_id INTEGER REFERENCES teams(id),
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_balls INTEGER DEFAULT 0,
    extras INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to innings table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'innings' AND column_name = 'total_balls') THEN
        ALTER TABLE innings ADD COLUMN total_balls INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'innings' AND column_name = 'extras') THEN
        ALTER TABLE innings ADD COLUMN extras INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'innings' AND column_name = 'is_completed') THEN
        ALTER TABLE innings ADD COLUMN is_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =============================================================================
-- BALLS TABLE (Complete ICC-compliant schema)
-- =============================================================================
CREATE TABLE IF NOT EXISTS balls (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    innings_id INTEGER REFERENCES innings(id),
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    batsman_id INTEGER REFERENCES players(id),
    bowler_id INTEGER REFERENCES players(id),
    runs INTEGER DEFAULT 0,
    extras INTEGER DEFAULT 0,
    is_wicket BOOLEAN DEFAULT false,
    dismissal_type VARCHAR,
    fielder_id INTEGER REFERENCES players(id),
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
);

-- Add missing ICC-compliant columns to balls table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'dismissal_type') THEN
        ALTER TABLE balls ADD COLUMN dismissal_type VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'fielder_id') THEN
        ALTER TABLE balls ADD COLUMN fielder_id INTEGER REFERENCES players(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_wide') THEN
        ALTER TABLE balls ADD COLUMN is_wide BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_no_ball') THEN
        ALTER TABLE balls ADD COLUMN is_no_ball BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_bye') THEN
        ALTER TABLE balls ADD COLUMN is_bye BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_leg_bye') THEN
        ALTER TABLE balls ADD COLUMN is_leg_bye BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_short_run') THEN
        ALTER TABLE balls ADD COLUMN is_short_run BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'is_dead_ball') THEN
        ALTER TABLE balls ADD COLUMN is_dead_ball BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'penalty_runs') THEN
        ALTER TABLE balls ADD COLUMN penalty_runs INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'batsman_crossed') THEN
        ALTER TABLE balls ADD COLUMN batsman_crossed BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balls' AND column_name = 'commentary') THEN
        ALTER TABLE balls ADD COLUMN commentary TEXT;
    END IF;
END $$;

-- =============================================================================
-- PLAYER STATS TABLE (Comprehensive cricket statistics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    player_id INTEGER REFERENCES players(id),
    innings_id INTEGER REFERENCES innings(id),
    runs_scored INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    fours INTEGER DEFAULT 0,
    sixes INTEGER DEFAULT 0,
    is_out BOOLEAN DEFAULT false,
    dismissal_type VARCHAR,
    balls_bowled INTEGER DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    wickets_taken INTEGER DEFAULT 0,
    maiden_overs INTEGER DEFAULT 0,
    wide_balls INTEGER DEFAULT 0,
    no_balls INTEGER DEFAULT 0,
    catches INTEGER DEFAULT 0,
    stumpings INTEGER DEFAULT 0,
    run_outs INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to player_stats table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'innings_id') THEN
        ALTER TABLE player_stats ADD COLUMN innings_id INTEGER REFERENCES innings(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'fours') THEN
        ALTER TABLE player_stats ADD COLUMN fours INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'sixes') THEN
        ALTER TABLE player_stats ADD COLUMN sixes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'dismissal_type') THEN
        ALTER TABLE player_stats ADD COLUMN dismissal_type VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'maiden_overs') THEN
        ALTER TABLE player_stats ADD COLUMN maiden_overs INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'wide_balls') THEN
        ALTER TABLE player_stats ADD COLUMN wide_balls INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'no_balls') THEN
        ALTER TABLE player_stats ADD COLUMN no_balls INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'catches') THEN
        ALTER TABLE player_stats ADD COLUMN catches INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'stumpings') THEN
        ALTER TABLE player_stats ADD COLUMN stumpings INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'run_outs') THEN
        ALTER TABLE player_stats ADD COLUMN run_outs INTEGER DEFAULT 0;
    END IF;
END $$;

-- =============================================================================
-- MATCH PLAYER SELECTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS match_player_selections (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    team_id INTEGER REFERENCES teams(id),
    player_id INTEGER REFERENCES players(id),
    is_playing BOOLEAN DEFAULT true,
    batting_order INTEGER,
    is_captain BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to match_player_selections table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_player_selections' AND column_name = 'batting_order') THEN
        ALTER TABLE match_player_selections ADD COLUMN batting_order INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_player_selections' AND column_name = 'is_captain') THEN
        ALTER TABLE match_player_selections ADD COLUMN is_captain BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =============================================================================
-- DATA INITIALIZATION
-- =============================================================================

-- Create default admin user if not exists
INSERT INTO users (id, email, first_name, last_name, role)
SELECT 'admin-user-id', 'admin@cricket.com', 'Admin', 'User', 'global_admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@cricket.com');

-- Create sample franchises if none exist
INSERT INTO franchises (name, short_name, primary_color)
SELECT 'Mumbai Warriors', 'MW', '#1E40AF'
WHERE NOT EXISTS (SELECT 1 FROM franchises WHERE name = 'Mumbai Warriors');

INSERT INTO franchises (name, short_name, primary_color)
SELECT 'Chennai Champions', 'CC', '#DC2626'
WHERE NOT EXISTS (SELECT 1 FROM franchises WHERE name = 'Chennai Champions');

INSERT INTO franchises (name, short_name, primary_color)
SELECT 'Delhi Dynamos', 'DD', '#059669'
WHERE NOT EXISTS (SELECT 1 FROM franchises WHERE name = 'Delhi Dynamos');

INSERT INTO franchises (name, short_name, primary_color)
SELECT 'Kolkata Knights', 'KK', '#7C3AED'
WHERE NOT EXISTS (SELECT 1 FROM franchises WHERE name = 'Kolkata Knights');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Create performance indexes if they don't exist
DO $$ 
BEGIN
    -- Balls table indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_balls_match_innings') THEN
        CREATE INDEX idx_balls_match_innings ON balls(match_id, innings_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_balls_over_ball') THEN
        CREATE INDEX idx_balls_over_ball ON balls(over_number, ball_number);
    END IF;
    
    -- Player stats indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_player_stats_match_player') THEN
        CREATE INDEX idx_player_stats_match_player ON player_stats(match_id, player_id);
    END IF;
    
    -- Match player selections index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_match_selections_match_team') THEN
        CREATE INDEX idx_match_selections_match_team ON match_player_selections(match_id, team_id);
    END IF;
    
    -- Player franchise links index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_player_franchise_active') THEN
        CREATE INDEX idx_player_franchise_active ON player_franchise_links(franchise_id, is_active);
    END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Cricket Scorer Production Schema Migration Completed Successfully';
    RAISE NOTICE 'Version: 2025.01.25';
    RAISE NOTICE 'Tables: 12 tables created/updated with full column validation';
    RAISE NOTICE 'Admin User: admin@cricket.com with global_admin role';
    RAISE NOTICE 'Sample Data: 4 franchises initialized';
    RAISE NOTICE 'Indexes: Performance indexes created';
END $$;