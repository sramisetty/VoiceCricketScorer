#!/bin/bash

# Complete PostgreSQL Setup and Fix Script
# This script installs PostgreSQL, creates the database, and fixes authentication

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"
DB_PASSWORD="cricket_secure_password_2025"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Setting up PostgreSQL for Cricket Scorer..."

# Detect package manager and OS
if command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
    POSTGRES_SERVICE="postgresql"
elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    POSTGRES_SERVICE="postgresql"
elif command -v apt >/dev/null 2>&1; then
    PKG_MANAGER="apt"
    POSTGRES_SERVICE="postgresql"
else
    error "Unsupported package manager"
fi

log "Detected package manager: $PKG_MANAGER"

# Install PostgreSQL
log "Installing PostgreSQL..."
case $PKG_MANAGER in
    "yum"|"dnf")
        $PKG_MANAGER install -y postgresql-server postgresql-contrib
        
        # Initialize database if not already done
        if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
            postgresql-setup initdb 2>/dev/null || postgresql-setup --initdb 2>/dev/null || true
        fi
        ;;
    "apt")
        apt update
        apt install -y postgresql postgresql-contrib
        ;;
esac

# Start and enable PostgreSQL
log "Starting PostgreSQL service..."
systemctl start $POSTGRES_SERVICE
systemctl enable $POSTGRES_SERVICE

# Wait for PostgreSQL to start
sleep 5

# Find pg_hba.conf location
log "Finding PostgreSQL configuration files..."
PG_HBA_CONF=""
for path in /var/lib/pgsql/data/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf; do
    if [ -f "$path" ]; then
        PG_HBA_CONF="$path"
        break
    fi
done

if [ -z "$PG_HBA_CONF" ]; then
    # Try to get it from PostgreSQL
    PG_HBA_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'show hba_file;' 2>/dev/null | tr -d '\n' || echo "")
fi

if [ -z "$PG_HBA_CONF" ] || [ ! -f "$PG_HBA_CONF" ]; then
    error "Could not find pg_hba.conf file"
fi

log "Found pg_hba.conf at: $PG_HBA_CONF"

# Create PostgreSQL user and database
log "Creating PostgreSQL user and database..."
sudo -u postgres psql << EOF
-- Drop and recreate user to ensure clean state
DROP USER IF EXISTS cricket_user;
CREATE USER cricket_user WITH PASSWORD '$DB_PASSWORD';

-- Drop and recreate database to ensure clean state
DROP DATABASE IF EXISTS cricket_scorer;
CREATE DATABASE cricket_scorer OWNER cricket_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
ALTER USER cricket_user CREATEDB;

-- Exit
\q
EOF

log "✓ Created database and user"

# Backup and update pg_hba.conf
log "Updating PostgreSQL authentication configuration..."
cp "$PG_HBA_CONF" "$PG_HBA_CONF.backup.$(date +%Y%m%d_%H%M%S)"

# Remove any existing cricket_user entries
sed -i '/cricket_user/d' "$PG_HBA_CONF"

# Add new entries for cricket_user with md5 authentication at the top of the file
# This ensures they take precedence over default entries
{
    echo "# Cricket Scorer Database Authentication"
    echo "local   cricket_scorer    cricket_user                                md5"
    echo "host    cricket_scorer    cricket_user        127.0.0.1/32            md5"
    echo "host    cricket_scorer    cricket_user        ::1/128                 md5"
    echo ""
    cat "$PG_HBA_CONF"
} > "$PG_HBA_CONF.tmp" && mv "$PG_HBA_CONF.tmp" "$PG_HBA_CONF"

log "✓ Updated pg_hba.conf"

# Restart PostgreSQL to apply changes
log "Restarting PostgreSQL to apply configuration changes..."
systemctl restart $POSTGRES_SERVICE

# Wait for restart
sleep 5

# Test connection
log "Testing database connection..."
export PGPASSWORD="$DB_PASSWORD"
if psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT 1;" >/dev/null 2>&1; then
    log "✓ Database connection successful"
else
    error "Database connection failed - please check PostgreSQL logs"
fi

# Navigate to app directory
if [ -d "$APP_DIR/current" ]; then
    cd "$APP_DIR/current"
    WORK_DIR="$APP_DIR/current"
elif [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    WORK_DIR="$APP_DIR"
else
    error "App directory not found"
fi

log "Working in directory: $WORK_DIR"

# Update .env file with correct database configuration
log "Updating application configuration..."
SESSION_SECRET=$(openssl rand -base64 32)

cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://cricket_user:${DB_PASSWORD}@localhost:5432/cricket_scorer
PGUSER=cricket_user
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=cricket_scorer
PGHOST=localhost
PGPORT=5432

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}

# OpenAI Configuration (update with your API key)
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
APP_URL=http://localhost:3000
LOG_LEVEL=info
EOF

chown $APP_USER:$APP_USER .env
chmod 600 .env

log "✓ Updated application configuration"

# Test drizzle database connection
log "Testing application database connection..."
sudo -u $APP_USER npm run db:push

# Restart PM2 if running
if command -v pm2 >/dev/null 2>&1; then
    log "Restarting PM2 application..."
    sudo -u $APP_USER pm2 restart cricket-scorer 2>/dev/null || {
        sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true
        sudo -u $APP_USER pm2 start ecosystem.config.cjs 2>/dev/null || true
    }
    
    # Show PM2 status
    sudo -u $APP_USER pm2 status 2>/dev/null || log "PM2 not configured yet"
fi

log "✓ PostgreSQL setup completed successfully!"
log "Database: cricket_scorer"
log "User: cricket_user"
log "Host: localhost:5432"
log ""
log "Your Cricket Scorer application should now work with PostgreSQL!"

# Show final pg_hba.conf entries
log "Final pg_hba.conf entries for cricket_user:"
grep cricket_user "$PG_HBA_CONF" || log "No cricket_user entries found"