#!/bin/bash

# Emergency Database Connection Fix
# Resolves SSL certificate errors in production

set -e

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR"

echo "=== Emergency Database Connection Fix ==="

# Stop application
pm2 stop cricket-scorer 2>/dev/null || true

# Test direct database connection without SSL
echo "Testing database connection..."
PGPASSWORD=simple123 psql -h localhost -p 5432 -U cricket_user -d cricket_scorer -c "SELECT current_database(), current_user;" && echo "✓ Direct database connection works"

# Update DATABASE_URL to explicitly disable SSL for localhost connections
echo "Updating DATABASE_URL to disable SSL..."

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update DATABASE_URL to disable SSL for localhost
sed -i 's|DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer.*|DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer?sslmode=disable|' .env

echo "Updated DATABASE_URL:"
grep DATABASE_URL .env

# Rebuild server to pick up database connection changes
echo "Rebuilding server..."
npm run build:server

# Start application
echo "Starting application..."
pm2 start cricket-scorer
sleep 10

# Test application endpoints
echo "Testing application endpoints..."
LOCAL_TEST=$(curl -s -w "%{http_code}" http://localhost:3000/api/teams 2>/dev/null)
LOCAL_CODE="${LOCAL_TEST: -3}"
LOCAL_BODY="${LOCAL_TEST%???}"

if [ "$LOCAL_CODE" = "200" ]; then
    echo "✅ SUCCESS! Application is working"
    echo "Response: $LOCAL_BODY"
    
    # Test team creation
    echo "Testing team creation..."
    CREATE_TEST=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
         -H "Content-Type: application/json" \
         -d '{"name":"Test Team","shortName":"TST"}' 2>/dev/null)
    
    CREATE_CODE="${CREATE_TEST: -3}"
    CREATE_BODY="${CREATE_TEST%???}"
    
    if [ "$CREATE_CODE" = "200" ] || [ "$CREATE_CODE" = "201" ]; then
        echo "✅ Team creation working!"
        echo "Created: $CREATE_BODY"
    else
        echo "⚠ Team creation issue (HTTP $CREATE_CODE): $CREATE_BODY"
    fi
    
    echo ""
    echo "Application Status:"
    pm2 list
    echo ""
    echo "✅ Database connection fixed!"
    echo "✅ Application available at: https://score.ramisetty.net"
    
else
    echo "❌ Application still not responding (HTTP $LOCAL_CODE)"
    echo "Response: $LOCAL_BODY"
    echo ""
    echo "PM2 Logs:"
    pm2 logs cricket-scorer --lines 20
fi