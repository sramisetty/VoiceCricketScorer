-- Script to fix column name mismatches between Drizzle schema and production database
-- This handles the camelCase vs snake_case discrepancy

-- Fix teams table column names
DO $$ 
BEGIN
    -- Check and rename shortName to short_name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'shortName') THEN
        ALTER TABLE teams RENAME COLUMN "shortName" TO short_name;
    END IF;
    
    -- Check and rename franchiseId to franchise_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'franchiseId') THEN
        ALTER TABLE teams RENAME COLUMN "franchiseId" TO franchise_id;
    END IF;
    
    -- Check and rename isActive to is_active
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'isActive') THEN
        ALTER TABLE teams RENAME COLUMN "isActive" TO is_active;
    END IF;
    
    -- Check and rename createdAt to created_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'createdAt') THEN
        ALTER TABLE teams RENAME COLUMN "createdAt" TO created_at;
    END IF;
    
    -- Check and rename updatedAt to updated_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'updatedAt') THEN
        ALTER TABLE teams RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
END $$;

-- Fix franchises table column names
DO $$ 
BEGIN
    -- Check and rename shortName to short_name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'franchises' AND column_name = 'shortName') THEN
        ALTER TABLE franchises RENAME COLUMN "shortName" TO short_name;
    END IF;
END $$;

-- Fix players table column names
DO $$ 
BEGIN
    -- Check and rename franchiseId to franchise_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'franchiseId') THEN
        ALTER TABLE players RENAME COLUMN "franchiseId" TO franchise_id;
    END IF;
    
    -- Check and rename teamId to team_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'teamId') THEN
        ALTER TABLE players RENAME COLUMN "teamId" TO team_id;
    END IF;
    
    -- Check and rename battingOrder to batting_order
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'battingOrder') THEN
        ALTER TABLE players RENAME COLUMN "battingOrder" TO batting_order;
    END IF;
    
    -- Check and rename userId to user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'userId') THEN
        ALTER TABLE players RENAME COLUMN "userId" TO user_id;
    END IF;
    
    -- Check and rename contactInfo to contact_info
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'contactInfo') THEN
        ALTER TABLE players RENAME COLUMN "contactInfo" TO contact_info;
    END IF;
    
    -- Check and rename preferredPosition to preferred_position
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'preferredPosition') THEN
        ALTER TABLE players RENAME COLUMN "preferredPosition" TO preferred_position;
    END IF;
    
    -- Check and rename isActive to is_active
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'isActive') THEN
        ALTER TABLE players RENAME COLUMN "isActive" TO is_active;
    END IF;
    
    -- Check and rename createdAt to created_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'createdAt') THEN
        ALTER TABLE players RENAME COLUMN "createdAt" TO created_at;
    END IF;
    
    -- Check and rename updatedAt to updated_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'updatedAt') THEN
        ALTER TABLE players RENAME COLUMN "updatedAt" TO updated_at;
    END IF;
END $$;

-- Create player_franchise_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_franchise_links (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  franchise_id INTEGER NOT NULL REFERENCES franchises(id),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index to prevent duplicate player-franchise associations
CREATE UNIQUE INDEX IF NOT EXISTS unique_player_franchise ON player_franchise_links(player_id, franchise_id);

-- Add missing columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS availability BOOLEAN DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Grant permissions
GRANT ALL PRIVILEGES ON player_franchise_links TO cricket_user;
GRANT USAGE, SELECT ON SEQUENCE player_franchise_links_id_seq TO cricket_user;

-- Insert sample player-franchise links from existing franchise associations
INSERT INTO player_franchise_links (player_id, franchise_id, is_active)
SELECT p.id, p.franchise_id, true
FROM players p
WHERE p.franchise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_franchise_links pfl 
    WHERE pfl.player_id = p.id AND pfl.franchise_id = p.franchise_id
  );

-- Display summary
SELECT 'Column fixes completed successfully' as status;