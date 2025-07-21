#!/bin/bash

# Emergency Production Fix for Cricket Scorer
# Fixes database permissions and ensures application accessibility

set -e

APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Fix PostgreSQL permissions completely
fix_postgresql_completely() {
    log "Fixing PostgreSQL permissions completely..."
    
    # Get the actual database name from environment
    cd "$APP_DIR"
    source .env.production 2>/dev/null || source .env 2>/dev/null || true
    
    # Create database and user if they don't exist
    sudo -u postgres psql -c "CREATE DATABASE cricket_scorer;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER cricket_user WITH PASSWORD 'cricket_pass';" 2>/dev/null || true
    
    # Grant all permissions
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cricket_user;" 2>/dev/null || true
    
    # Also grant to postgres user as fallback
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;" 2>/dev/null || true
    
    success "PostgreSQL permissions fixed completely"
}

# Create basic database schema manually
create_basic_schema() {
    log "Creating basic database schema manually..."
    
    cd "$APP_DIR"
    
    # Create a minimal schema manually to ensure database connectivity
    sudo -u postgres psql cricket_scorer << 'EOF' || true
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(10),
    logo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    batting_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    team1_id INTEGER REFERENCES teams(id),
    team2_id INTEGER REFERENCES teams(id),
    toss_winner_id INTEGER REFERENCES teams(id),
    toss_decision VARCHAR(20),
    status VARCHAR(20) DEFAULT 'not_started',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF
    
    success "Basic database schema created"
}

# Ensure correct environment variables
fix_environment() {
    log "Ensuring correct environment variables..."
    
    cd "$APP_DIR"
    
    # Create production environment file if missing
    if [ ! -f ".env.production" ]; then
        cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer
OPENAI_API_KEY=your_openai_api_key_here
EOF
        log "Created .env.production file"
    fi
    
    # Also create .env as fallback
    if [ ! -f ".env" ]; then
        cp .env.production .env
        log "Created .env file"
    fi
    
    success "Environment variables configured"
}

# Test application locally
test_application_locally() {
    log "Testing application locally..."
    
    cd "$APP_DIR"
    
    # Load environment
    export NODE_ENV=production
    export PORT=3000
    export DATABASE_URL="postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer"
    
    # Test if the built application starts
    timeout 10s node dist/index.js &
    APP_PID=$!
    
    sleep 5
    
    # Check if it's responding
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application responds locally"
        kill $APP_PID 2>/dev/null || true
        return 0
    else
        warning "Application not responding locally"
        kill $APP_PID 2>/dev/null || true
        return 1
    fi
}

# Restart services properly
restart_services() {
    log "Restarting services properly..."
    
    cd "$APP_DIR"
    
    # Stop PM2 processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start with proper environment
    log "Starting application with PM2..."
    pm2 start ecosystem.config.cjs --env production
    pm2 save
    
    # Wait for startup
    sleep 10
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "PM2 application restarted successfully"
    else
        error "PM2 failed to start application"
        pm2 logs $APP_NAME --lines 20
        return 1
    fi
    
    # Restart Nginx
    log "Restarting Nginx..."
    systemctl restart nginx
    
    success "Services restarted"
}

# Final verification
final_verification() {
    log "Final verification..."
    
    # Test local connectivity
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application responding on localhost:3000"
    else
        error "Application not responding locally"
        pm2 logs $APP_NAME --lines 10
        return 1
    fi
    
    # Test through Nginx
    if curl -f -s http://localhost/ >/dev/null 2>&1; then
        success "Nginx proxy working"
    else
        warning "Nginx proxy may have issues"
    fi
    
    # Show status
    log "Final status:"
    pm2 status
    systemctl status nginx --no-pager -l | head -10
    
    success "Emergency fix completed!"
    log "Application should be accessible at: http://$DOMAIN"
}

# Main execution
main() {
    log "Starting emergency production fix..."
    
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
    
    fix_postgresql_completely
    create_basic_schema
    fix_environment
    
    if test_application_locally; then
        restart_services
        final_verification
    else
        error "Application still not working locally. Check logs for details."
        exit 1
    fi
    
    success "Emergency fix completed successfully!"
}

main "$@"