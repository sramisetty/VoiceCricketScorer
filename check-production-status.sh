#!/bin/bash

# Check production status script for Cricket Scorer
echo "=== Cricket Scorer Production Status Check ==="
echo "Date: $(date)"
echo ""

# Check if on production server
if [ "$(hostname -I | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
else
    echo "ℹ This appears to be development environment"
    echo "Run this script on production server: 67.227.251.94"
    exit 0
fi

echo ""
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== Port 3000 Status ==="
if lsof -i:3000 >/dev/null 2>&1; then
    echo "✓ Port 3000 is in use"
    lsof -i:3000
else
    echo "✗ Port 3000 is not in use"
fi

echo ""
echo "=== Application Response Test ==="
if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
    echo "✓ Application responds on localhost:3000"
else
    echo "✗ Application not responding on localhost:3000"
    
    echo ""
    echo "=== Attempting to restart application ==="
    cd /opt/cricket-scorer
    
    # Load environment variables
    if [ -f ".env" ]; then
        echo "Loading environment variables..."
        export $(grep -v '^#' .env | xargs)
        echo "OPENAI_API_KEY loaded: ${OPENAI_API_KEY:0:8}..."
    fi
    
    # Restart PM2
    pm2 restart cricket-scorer || pm2 start ecosystem.config.cjs --env production
    sleep 5
    
    # Check again
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        echo "✓ Application restarted successfully"
    else
        echo "✗ Application still not responding"
        echo "=== PM2 Logs ==="
        pm2 logs cricket-scorer --lines 20
    fi
fi

echo ""
echo "=== Nginx Status ==="
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx is running"
else
    echo "✗ Nginx is not running"
    echo "Starting nginx..."
    systemctl start nginx
fi

echo ""
echo "=== Website Access Test ==="
if curl -f -s -H 'Host: score.ramisetty.net' http://localhost/ >/dev/null 2>&1; then
    echo "✓ Website accessible via nginx proxy"
else
    echo "✗ Website not accessible via nginx"
    echo "Nginx configuration may need updating"
fi

echo ""
echo "=== API Endpoint Tests ==="
echo "Testing public API endpoints..."

# Test public matches endpoint (no auth required)
if curl -f -s http://localhost:3000/api/matches >/dev/null 2>&1; then
    echo "✓ Matches API working (public endpoint)"
else
    echo "✗ Matches API not responding"
fi

# Test teams endpoint (no auth required for GET)
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ Teams API working (public endpoint)"
else
    echo "✗ Teams API not responding"
fi

# Test franchises endpoint (no auth required for GET)
if curl -f -s http://localhost:3000/api/franchises >/dev/null 2>&1; then
    echo "✓ Franchises API working (public endpoint)"
else
    echo "✗ Franchises API not responding"
fi

echo ""
echo "Note: Protected endpoints (Players, User Management) require authentication"
echo "      and cannot be tested without admin credentials."

echo ""
echo "=== Database Connection Test ==="
if [ -f "quick-database-test.cjs" ]; then
    echo "Running comprehensive database test..."
    node quick-database-test.cjs
elif [ -f "test-database-connection.js" ]; then
    echo "Running comprehensive database test..."
    node test-database-connection.js
else
    echo "Using basic database test..."
    if command -v psql >/dev/null 2>&1; then
        # Test database connection using environment variables
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | xargs) 2>/dev/null
        fi
        
        if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM teams;" >/dev/null 2>&1; then
            echo "✓ Database connection working"
            echo "Teams in database: $(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM teams;" 2>/dev/null | xargs)"
            echo "Players in database: $(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM players;" 2>/dev/null | xargs)"
            echo "Users in database: $(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)"
        else
            echo "✗ Database connection failed"
            echo "Check database credentials and connection"
            echo "DATABASE_URL format should be: postgresql://username:password@localhost/database_name"
        fi
    else
        echo "⚠ psql not available for database testing"
        echo "⚠ Install PostgreSQL client or use: apt install postgresql-client"
    fi
fi

echo ""
echo "=== Environment Variables Check ==="
cd /opt/cricket-scorer 2>/dev/null || cd /root/cricket-scorer 2>/dev/null || echo "Could not find app directory"
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    if grep -q "DATABASE_URL" .env; then
        echo "✓ DATABASE_URL configured"
    else
        echo "✗ DATABASE_URL missing from .env"
    fi
    if grep -q "OPENAI_API_KEY" .env; then
        echo "✓ OPENAI_API_KEY configured"
    else
        echo "✗ OPENAI_API_KEY missing from .env"
    fi
else
    echo "✗ .env file missing"
fi

echo ""
echo "=== Final Status ==="
echo "Application should be accessible at: https://score.ramisetty.net"
echo "If still showing test page, nginx may be caching or needs restart"
echo ""
echo "Quick fixes to try:"
echo "1. sudo systemctl reload nginx"
echo "2. sudo systemctl restart nginx"
echo "3. Clear browser cache"