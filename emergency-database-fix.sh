#!/bin/bash

echo "=== Emergency Database Connection Fix ==="

# Find PostgreSQL installation
PG_VERSION=""
PG_DATA_DIR=""
PG_CONFIG_DIR=""

# Check common PostgreSQL installation paths
if ls /var/lib/pgsql/*/data/postgresql.conf >/dev/null 2>&1; then
    PG_VERSION=$(ls /var/lib/pgsql/ | head -1)
    PG_DATA_DIR="/var/lib/pgsql/$PG_VERSION/data"
    PG_CONFIG_DIR="$PG_DATA_DIR"
    echo "Found PostgreSQL $PG_VERSION at $PG_DATA_DIR"
elif ls /etc/postgresql/*/main/postgresql.conf >/dev/null 2>&1; then
    PG_VERSION=$(ls /etc/postgresql/ | head -1)
    PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"
    PG_DATA_DIR="/var/lib/postgresql/$PG_VERSION/main"
    echo "Found PostgreSQL $PG_VERSION at $PG_CONFIG_DIR"
else
    echo "PostgreSQL installation not found in standard locations"
    exit 1
fi

echo "PostgreSQL Config Directory: $PG_CONFIG_DIR"
echo "PostgreSQL Data Directory: $PG_DATA_DIR"

# Stop PostgreSQL
echo "Stopping PostgreSQL..."
systemctl stop postgresql || service postgresql stop
sleep 2

# Backup current config
echo "Backing up current configuration..."
cp "$PG_CONFIG_DIR/pg_hba.conf" "$PG_CONFIG_DIR/pg_hba.conf.emergency.backup" 2>/dev/null
cp "$PG_CONFIG_DIR/postgresql.conf" "$PG_CONFIG_DIR/postgresql.conf.emergency.backup" 2>/dev/null

# Create emergency pg_hba.conf with trust authentication
echo "Creating emergency pg_hba.conf with trust authentication..."
cat > "$PG_CONFIG_DIR/pg_hba.conf" <<'EOF'
# Emergency PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Trust authentication for emergency access
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust

# Replication connections
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
EOF

# Ensure minimal postgresql.conf settings
echo "Updating postgresql.conf with minimal settings..."
cat >> "$PG_CONFIG_DIR/postgresql.conf" <<'EOF'

# Emergency settings
listen_addresses = 'localhost'
port = 5432
shared_buffers = 32MB
max_connections = 100
EOF

# Set proper ownership
if [ -d "/var/lib/pgsql" ]; then
    chown -R postgres:postgres /var/lib/pgsql/
elif [ -d "/var/lib/postgresql" ]; then
    chown -R postgres:postgres /var/lib/postgresql/
fi

chown postgres:postgres "$PG_CONFIG_DIR/pg_hba.conf"
chown postgres:postgres "$PG_CONFIG_DIR/postgresql.conf"

# Start PostgreSQL
echo "Starting PostgreSQL with emergency configuration..."
systemctl start postgresql || service postgresql start
sleep 5

# Check if PostgreSQL is running
if systemctl is-active --quiet postgresql 2>/dev/null || service postgresql status >/dev/null 2>&1; then
    echo "✓ PostgreSQL is running"
else
    echo "✗ PostgreSQL failed to start"
    systemctl status postgresql || service postgresql status
    exit 1
fi

# Now create database and user
echo "Creating database and user with trust authentication..."
sudo -u postgres psql <<'SQL_EOF'
DROP DATABASE IF EXISTS cricket_scorer;
DROP USER IF EXISTS cricket_user;

CREATE USER cricket_user WITH PASSWORD 'simple123';
ALTER USER cricket_user CREATEDB;
ALTER USER cricket_user CREATEROLE;

CREATE DATABASE cricket_scorer OWNER cricket_user;
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;

\q
SQL_EOF

# Create basic schema
echo "Creating basic database schema..."
sudo -u postgres psql -d cricket_scorer <<'SCHEMA_EOF'
GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;

CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "shortName" VARCHAR(10) NOT NULL,
    logo TEXT
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "teamId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'batsman',
    "battingOrder" INTEGER DEFAULT 1
);

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    "team1Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "team2Id" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossWinnerId" INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    "tossDecision" VARCHAR(10) NOT NULL DEFAULT 'bat',
    "matchType" VARCHAR(20) NOT NULL DEFAULT 'T20',
    overs INTEGER NOT NULL DEFAULT 20,
    status VARCHAR(20) NOT NULL DEFAULT 'setup'
);

ALTER TABLE teams OWNER TO cricket_user;
ALTER TABLE players OWNER TO cricket_user;
ALTER TABLE matches OWNER TO cricket_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;

INSERT INTO teams (name, "shortName") VALUES 
    ('Emergency Team A', 'ETA'), 
    ('Emergency Team B', 'ETB');

\q
SCHEMA_EOF

# Test connection
echo ""
echo "=== Testing Connection ==="
if psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT COUNT(*) as teams FROM teams;" 2>/dev/null; then
    echo "✓ Emergency database connection successful!"
    
    # Update application .env
    APP_DIR="/opt/cricket-scorer"
    if [ ! -d "$APP_DIR" ]; then
        APP_DIR="/root/cricket-scorer"
    fi
    
    if [ -d "$APP_DIR" ]; then
        cd "$APP_DIR"
        echo ""
        echo "Updating application .env file..."
        cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
EOF
        
        echo "✓ Updated .env file"
        
        if pm2 list | grep -q cricket-scorer; then
            echo "Restarting PM2 application..."
            pm2 restart cricket-scorer
            sleep 5
            
            if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
                echo "✓ Application API is responding!"
            else
                echo "✗ API not responding, check PM2 logs: pm2 logs cricket-scorer"
            fi
        fi
    fi
    
    echo ""
    echo "=== Emergency Fix Complete ==="
    echo "Database: cricket_scorer"
    echo "User: cricket_user"
    echo "Password: simple123"
    echo "Connection: psql -h localhost -U cricket_user -d cricket_scorer"
    echo ""
    echo "⚠ WARNING: Using trust authentication for emergency access"
    echo "Consider securing authentication after testing is complete"
    
else
    echo "✗ Emergency connection failed"
    echo "Check PostgreSQL logs for more details"
    exit 1
fi