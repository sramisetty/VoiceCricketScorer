-- Create player_franchise_links table for production
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

-- Add missing columns to existing tables if they don't exist
ALTER TABLE players ADD COLUMN IF NOT EXISTS availability BOOLEAN DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE franchises ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Grant permissions
GRANT ALL PRIVILEGES ON player_franchise_links TO cricket_user;
GRANT USAGE, SELECT ON SEQUENCE player_franchise_links_id_seq TO cricket_user;

-- Insert some sample player-franchise links if none exist
INSERT INTO player_franchise_links (player_id, franchise_id, is_active)
SELECT p.id, p.franchise_id, true
FROM players p
WHERE p.franchise_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_franchise_links pfl 
    WHERE pfl.player_id = p.id AND pfl.franchise_id = p.franchise_id
  );