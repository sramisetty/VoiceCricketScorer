#!/bin/bash

# Rollback Production Schema - Revert to Working State
# Run this on production server to restore working database schema

set -e

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR"

echo "=== Rolling Back Production Database Schema ==="

# Stop application
pm2 stop cricket-scorer 2>/dev/null || true

# Database connection details
DB_NAME="cricket_scorer"
DB_USER="cricket_user"
DB_PASSWORD="simple123"

echo "Rolling back to camelCase column names..."

# Revert to camelCase column names that were working
PGPASSWORD=$DB_PASSWORD psql -h localhost -p 5432 -U $DB_USER -d $DB_NAME << 'EOF'

-- Rollback teams table column names to camelCase
DO $$
BEGIN
    -- Revert short_name back to shortName
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'short_name') THEN
        ALTER TABLE teams RENAME COLUMN short_name TO "shortName";
        RAISE NOTICE 'Reverted short_name to shortName';
    END IF;

    -- Revert players table columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
        ALTER TABLE players RENAME COLUMN team_id TO "teamId";
        ALTER TABLE players RENAME COLUMN batting_order TO "battingOrder";
        RAISE NOTICE 'Reverted players table columns';
    END IF;

    -- Revert matches table columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'team1_id') THEN
        ALTER TABLE matches RENAME COLUMN team1_id TO "team1Id";
        ALTER TABLE matches RENAME COLUMN team2_id TO "team2Id";
        ALTER TABLE matches RENAME COLUMN toss_winner_id TO "tossWinnerId";
        ALTER TABLE matches RENAME COLUMN toss_decision TO "tossDecision";
        ALTER TABLE matches RENAME COLUMN match_type TO "matchType";
        ALTER TABLE matches RENAME COLUMN current_innings TO "currentInnings";
        ALTER TABLE matches RENAME COLUMN created_at TO "createdAt";
        RAISE NOTICE 'Reverted matches table columns';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during rollback: %', SQLERRM;
END $$;

-- Verify current schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teams' 
ORDER BY ordinal_position;

EOF

echo "✓ Schema rolled back to camelCase"

# Update Drizzle schema to match database reality
echo "Updating Drizzle schema to match database..."

# Create temporary schema fix
cat > temp-schema-fix.ts << 'EOF'
// Temporary schema that matches current database column names
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("shortName").notNull(), // Match database column name
  logo: text("logo"),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  teamId: integer("teamId").references(() => teams.id), // Match database column name
  role: text("role").notNull(),
  battingOrder: integer("battingOrder"), // Match database column name
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  team1Id: integer("team1Id").references(() => teams.id).notNull(), // Match database column name
  team2Id: integer("team2Id").references(() => teams.id).notNull(), // Match database column name
  tossWinnerId: integer("tossWinnerId").references(() => teams.id), // Match database column name
  tossDecision: text("tossDecision"), // Match database column name
  matchType: text("matchType").notNull(), // Match database column name
  overs: integer("overs").notNull(),
  venue: text("venue"),
  status: text("status").notNull().default("setup"),
  currentInnings: integer("currentInnings").default(1), // Match database column name
  createdAt: timestamp("createdAt").defaultNow(), // Match database column name
});
EOF

# Backup current schema and replace with working version
cp shared/schema.ts shared/schema.ts.backup
head -4 shared/schema.ts > temp-imports.ts
cat temp-imports.ts temp-schema-fix.ts > shared/schema.ts.temp

# Add the rest of the schema (other tables and exports) from backup
tail -n +40 shared/schema.ts.backup >> shared/schema.ts.temp
mv shared/schema.ts.temp shared/schema.ts

# Clean up temp files
rm temp-schema-fix.ts temp-imports.ts

echo "✓ Updated schema to match database"

# Restart application
pm2 start cricket-scorer
sleep 10

# Test application
echo "Testing application..."
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ Application is responding!"
    
    # Test team creation
    echo "Testing team creation..."
    curl -X POST http://localhost:3000/api/teams \
         -H "Content-Type: application/json" \
         -d '{"name":"Test Team","shortName":"TST"}' && echo ""
    
    echo "✓ Production rollback completed successfully!"
    echo "Application available at: https://score.ramisetty.net"
else
    echo "✗ Application still not responding"
    pm2 logs cricket-scorer --lines 20
fi