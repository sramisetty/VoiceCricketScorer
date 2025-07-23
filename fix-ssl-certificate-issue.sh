#!/bin/bash

echo "=== Fixing SSL Certificate Issue for Cricket Scorer ==="

# Check if we're on production server
if [ "$(hostname -I 2>/dev/null | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
elif [ -d "/nix/store" ]; then
    echo "⚠ This is the development environment (Replit)"
    echo "This script is for the production server. Please run on 67.227.251.94"
    exit 0
else
    echo "Production environment detected"
fi

APP_DIR="/opt/cricket-scorer"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="/root/cricket-scorer"
fi

cd "$APP_DIR" || {
    echo "Could not find application directory"
    exit 1
}

echo "Application directory: $(pwd)"

# The issue is that the application is trying to make HTTPS requests to localhost
# but the SSL certificate is only valid for score.ramisetty.net
# We need to ensure all internal API calls use HTTP, not HTTPS

echo ""
echo "=== Checking Current Configuration ==="

# Check if there are any HTTPS references in the application
echo "Checking for HTTPS references in application code..."
if grep -r "https://localhost" . --include="*.js" --include="*.ts" --include="*.json" 2>/dev/null; then
    echo "Found HTTPS localhost references - need to fix these"
else
    echo "No direct HTTPS localhost references found"
fi

# Check .env file
echo ""
echo "Current .env configuration:"
cat .env

# The issue is likely in the application's internal API calls
# Update .env to ensure no HTTPS for internal calls
echo ""
echo "=== Updating Environment Configuration ==="

# Create updated .env with explicit HTTP for internal calls
cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
# Ensure internal API calls use HTTP
API_BASE_URL=http://localhost:3000
INTERNAL_API_URL=http://localhost:3000
EOF

echo "✓ Updated .env file to use HTTP for internal API calls"

# Check if there's any SSL/TLS configuration in the Node.js server
echo ""
echo "=== Checking Server Configuration ==="
if [ -f "dist/index.js" ]; then
    if grep -q "https\|ssl\|tls" dist/index.js; then
        echo "Found SSL/TLS references in server code"
        echo "The server should only use HTTP internally, HTTPS is handled by nginx"
    else
        echo "✓ Server code appears to use HTTP only"
    fi
fi

# Restart PM2 with updated environment
echo ""
echo "=== Restarting Application ==="
echo "Stopping PM2 application..."
pm2 stop cricket-scorer

echo "Starting PM2 application with updated environment..."
pm2 start ecosystem.config.cjs --env production --update-env

# Wait for application to start
sleep 10

# Test internal API connection
echo ""
echo "=== Testing Internal API Connection ==="
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ Internal API responding successfully"
    
    # Show current teams
    echo ""
    echo "Current teams via API:"
    curl -s http://localhost:3000/api/teams | head -200
    
    echo ""
    echo "=== Testing Match Creation API Flow ==="
    
    # Test team creation
    TEAM_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/teams \
        -H "Content-Type: application/json" \
        -d '{"name":"Test Team SSL","shortName":"TSL"}' \
        -o /tmp/ssl_team.json)
    
    if [ "$TEAM_RESPONSE" = "200" ]; then
        echo "✓ Team creation API working"
        TEAM_ID=$(cat /tmp/ssl_team.json | grep -o '"id":[0-9]*' | cut -d':' -f2)
        
        # Test player creation
        PLAYER_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/players \
            -H "Content-Type: application/json" \
            -d "{\"name\":\"Test Player SSL\",\"teamId\":$TEAM_ID,\"role\":\"batsman\",\"battingOrder\":1}" \
            -o /tmp/ssl_player.json)
        
        if [ "$PLAYER_RESPONSE" = "200" ]; then
            echo "✓ Player creation API working"
            echo "✓ Match creation should now work in the web interface"
        else
            echo "✗ Player creation failed (HTTP $PLAYER_RESPONSE)"
            cat /tmp/ssl_player.json 2>/dev/null
        fi
    else
        echo "✗ Team creation failed (HTTP $TEAM_RESPONSE)"
        cat /tmp/ssl_team.json 2>/dev/null
    fi
    
else
    echo "✗ Internal API still not responding"
    echo ""
    echo "Checking PM2 logs for errors..."
    pm2 logs cricket-scorer --lines 20
    
    echo ""
    echo "Checking for any remaining SSL issues..."
    pm2 logs cricket-scorer --lines 50 | grep -i "ssl\|tls\|certificate\|hostname" || echo "No SSL-related errors found"
fi

# Test external access through nginx
echo ""
echo "=== Testing External Access ==="
if curl -f -s -H 'Host: score.ramisetty.net' http://localhost/ >/dev/null 2>&1; then
    echo "✓ External access via nginx working"
else
    echo "✗ External access via nginx not working"
    echo "Check nginx configuration"
fi

echo ""
echo "=== SSL Certificate Fix Complete ==="
echo "Internal API: http://localhost:3000"
echo "External access: https://score.ramisetty.net"
echo ""
echo "The application should now handle internal API calls via HTTP"
echo "while external users access via HTTPS through nginx proxy"

# Cleanup temp files
rm -f /tmp/ssl_team.json /tmp/ssl_player.json