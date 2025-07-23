#!/bin/bash

# Quick fix for database connection issues
echo "=== Cricket Scorer Database Connection Fix ==="

# Ensure PostgreSQL is running
systemctl start postgresql
systemctl enable postgresql

# Wait for service to be ready
sleep 3

# Fix database setup
echo "Setting up cricket database properly..."

# Create user and database as postgres superuser
sudo -u postgres psql <<'EOF'
-- Drop existing user and database if they exist (clean slate)
DROP DATABASE IF EXISTS cricket_scorer;
DROP USER IF EXISTS cricket_user;

-- Create user with proper permissions
CREATE USER cricket_user WITH PASSWORD 'cricket_pass';
ALTER USER cricket_user CREATEDB;
ALTER USER cricket_user CREATEROLE;

-- Create database
CREATE DATABASE cricket_scorer OWNER cricket_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
EOF

# Set up database schema
echo "Creating database schema..."
sudo -u postgres psql -d cricket_scorer <<'SCHEMA_EOF'
-- Grant schema permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;

-- Create essential tables
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "shortName" VARCHAR(10) NOT NULL,
    logo TEXT
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "teamId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'batsman',
    "battingOrder" INTEGER
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    "team1Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "team2Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossWinnerId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossDecision" VARCHAR(10) NOT NULL DEFAULT 'bat',
    "matchType" VARCHAR(20) NOT NULL DEFAULT 'T20',
    overs INTEGER NOT NULL DEFAULT 20,
    status VARCHAR(20) NOT NULL DEFAULT 'setup'
);

-- Grant permissions on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;

-- Insert test data
INSERT INTO teams (name, "shortName") VALUES 
    ('Test Team 1', 'T1'), 
    ('Test Team 2', 'T2')
ON CONFLICT DO NOTHING;
SCHEMA_EOF

echo ""
echo "=== Connection Test ==="
echo "Testing database connection..."

# Test connection (this is the correct way)
if PGPASSWORD=cricket_pass psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT COUNT(*) FROM teams;" >/dev/null 2>&1; then
    echo "✓ Database connection successful!"
    echo ""
    echo "=== Usage ==="
    echo "To connect to the database manually, use:"
    echo "PGPASSWORD=cricket_pass psql -h localhost -U cricket_user -d cricket_scorer"
    echo ""
    echo "Or export the password first:"
    echo "export PGPASSWORD=cricket_pass"
    echo "psql -h localhost -U cricket_user -d cricket_scorer"
    echo ""
    echo "Current data in database:"
    PGPASSWORD=cricket_pass psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT id, name, \"shortName\" FROM teams;"
else
    echo "✗ Database connection failed"
    echo "Check PostgreSQL service status: systemctl status postgresql"
fi

echo ""
echo "=== Application Environment ==="
cd /opt/cricket-scorer 2>/dev/null || cd /root/cricket-scorer 2>/dev/null || {
    echo "Could not find application directory"
    exit 1
}

# Update .env file with correct database URL
echo "Updating .env file with correct database URL..."
cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
EOF

echo "✓ .env file updated"

# Restart PM2 application if it's running
if pm2 list | grep -q cricket-scorer; then
    echo "Restarting PM2 application..."
    pm2 restart cricket-scorer
    sleep 5
    
    # Test API
    if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
        echo "✓ Application API is responding"
    else
        echo "✗ Application API not responding - check PM2 logs: pm2 logs cricket-scorer"
    fi
else
    echo "PM2 application not running - start with: pm2 start ecosystem.config.cjs --env production"
fi

echo ""
echo "=== Fix Complete ==="
echo "Database: cricket_scorer"
echo "User: cricket_user"  
echo "Password: cricket_pass"
echo "Connection: PGPASSWORD=cricket_pass psql -h localhost -U cricket_user -d cricket_scorer"