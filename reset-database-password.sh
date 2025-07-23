#!/bin/bash

echo "=== Resetting Cricket Database Password ==="

# Ensure PostgreSQL is running
systemctl start postgresql
systemctl enable postgresql
sleep 3

echo "Resetting database user and password..."

# Reset everything as postgres superuser
sudo -u postgres psql <<'EOF'
-- Drop and recreate user with new password
DROP DATABASE IF EXISTS cricket_scorer;
DROP USER IF EXISTS cricket_user;

-- Create user with a simple, known password
CREATE USER cricket_user WITH PASSWORD 'simple123';
ALTER USER cricket_user CREATEDB;
ALTER USER cricket_user CREATEROLE;

-- Create database
CREATE DATABASE cricket_scorer OWNER cricket_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;

-- Display user info for verification
\du cricket_user
EOF

echo ""
echo "Setting up database schema and permissions..."

# Set up schema with proper permissions
sudo -u postgres psql -d cricket_scorer <<'SCHEMA_EOF'
-- Grant schema permissions first
GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;

-- Create tables
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
    "battingOrder" INTEGER DEFAULT 1
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

-- Ensure cricket_user owns everything
ALTER TABLE teams OWNER TO cricket_user;
ALTER TABLE players OWNER TO cricket_user;
ALTER TABLE matches OWNER TO cricket_user;

-- Grant all permissions explicitly
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cricket_user;

-- Insert test data
INSERT INTO teams (name, "shortName") VALUES 
    ('Sample Team A', 'STA'), 
    ('Sample Team B', 'STB')
ON CONFLICT DO NOTHING;

-- Verify tables exist
\dt
SCHEMA_EOF

echo ""
echo "=== Testing New Password ==="

# Test with new simple password
if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT COUNT(*) as team_count FROM teams;" 2>/dev/null; then
    echo "✓ Database connection successful with new password!"
    
    echo ""
    echo "=== Connection Details ==="
    echo "Database: cricket_scorer"
    echo "Username: cricket_user"
    echo "Password: simple123"
    echo ""
    echo "Manual connection command:"
    echo "PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer"
    
    echo ""
    echo "Current teams in database:"
    PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT id, name, \"shortName\" FROM teams;"
    
else
    echo "✗ Connection still failed. Trying alternative method..."
    
    # Alternative: Set password via ALTER USER
    sudo -u postgres psql -c "ALTER USER cricket_user WITH PASSWORD 'simple123';"
    
    # Test again
    sleep 2
    if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✓ Connection successful after password reset!"
    else
        echo "✗ Still having issues. Let's check pg_hba.conf authentication method..."
        
        # Check current authentication method
        echo "Current pg_hba.conf settings:"
        grep -E "^(local|host)" /var/lib/pgsql/*/data/pg_hba.conf 2>/dev/null || \
        grep -E "^(local|host)" /etc/postgresql/*/main/pg_hba.conf 2>/dev/null
        
        # Force md5 authentication for local connections
        PG_VERSION=$(ls /var/lib/pgsql/ 2>/dev/null | head -1)
        if [ -n "$PG_VERSION" ]; then
            HBA_FILE="/var/lib/pgsql/$PG_VERSION/data/pg_hba.conf"
        else
            HBA_FILE="/etc/postgresql/15/main/pg_hba.conf"
        fi
        
        if [ -f "$HBA_FILE" ]; then
            echo "Updating pg_hba.conf to use md5 authentication..."
            cp "$HBA_FILE" "$HBA_FILE.backup"
            
            # Ensure md5 authentication for local connections
            sed -i 's/local.*all.*all.*peer/local   all             all                                     md5/' "$HBA_FILE"
            sed -i 's/host.*all.*all.*127.0.0.1\/32.*ident/host    all             all             127.0.0.1\/32            md5/' "$HBA_FILE"
            
            systemctl reload postgresql
            sleep 3
            
            # Test final time
            if PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
                echo "✓ Connection successful after authentication fix!"
            else
                echo "✗ Authentication still failing. Manual intervention may be needed."
            fi
        fi
    fi
fi

echo ""
echo "=== Updating Application Configuration ==="

# Update application .env file
APP_DIR="/opt/cricket-scorer"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="/root/cricket-scorer"
fi

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    
    # Update .env with new password
    cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
EOF
    
    echo "✓ Updated .env file with new database password"
    
    # Restart PM2 if running
    if pm2 list | grep -q cricket-scorer; then
        echo "Restarting PM2 application..."
        pm2 restart cricket-scorer
        sleep 5
        
        # Test API
        if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
            echo "✓ Application API is now responding!"
            
            # Show current teams via API
            echo ""
            echo "Teams available via API:"
            curl -s http://localhost:3000/api/teams | head -200
        else
            echo "✗ API still not responding. Check PM2 logs:"
            pm2 logs cricket-scorer --lines 10
        fi
    else
        echo "PM2 not running. Start with:"
        echo "cd $APP_DIR && pm2 start ecosystem.config.cjs --env production"
    fi
else
    echo "⚠ Application directory not found"
fi

echo ""
echo "=== Reset Complete ==="
echo "New database credentials:"
echo "  Database: cricket_scorer"
echo "  User: cricket_user"
echo "  Password: simple123"
echo "  Connection: PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer"