#!/bin/bash

# Fix Production Deployment - Resolve 502 Gateway Issues
# Run this to fix the deployment script and restart services properly

set -e

APP_DIR="/opt/cricket-scorer"
cd "$APP_DIR"

echo "=== Fixing Production Deployment Issues ==="

# Check if .env exists and has required keys
if [ -f ".env" ]; then
    echo "✓ .env file exists, checking contents..."
    cat .env
    
    # Ensure critical environment variables are set
    if ! grep -q "OPENAI_API_KEY=" .env || ! grep -q "DATABASE_URL=" .env; then
        echo "✗ Missing critical environment variables in .env"
        exit 1
    fi
    
    # Load environment variables
    export $(grep -v '^#' .env | xargs)
    echo "✓ Environment variables loaded"
else
    echo "✗ .env file missing!"
    exit 1
fi

# Stop and restart PM2 properly
echo "Restarting PM2 application..."
pm2 stop cricket-scorer 2>/dev/null || true
pm2 delete cricket-scorer 2>/dev/null || true

# Verify build files exist
if [ ! -f "dist/index.js" ]; then
    echo "Building server..."
    npm run build:server
fi

if [ ! -d "server/public" ]; then
    echo "Building client..."
    npm run build:client
fi

# Start PM2 with explicit environment variables
echo "Starting PM2 with environment variables..."
pm2 start ecosystem.config.cjs --env production

# Wait for application to start
sleep 10

# Test application locally
echo "Testing application..."
LOCAL_TEST=$(curl -s -w "%{http_code}" http://localhost:3000/api/teams 2>/dev/null || echo "000")
LOCAL_CODE="${LOCAL_TEST: -3}"

if [ "$LOCAL_CODE" = "200" ]; then
    echo "✓ Application responding locally on port 3000"
else
    echo "✗ Application not responding locally (HTTP $LOCAL_CODE)"
    echo "PM2 logs:"
    pm2 logs cricket-scorer --lines 20
    exit 1
fi

# Check nginx configuration
echo "Checking nginx configuration..."
nginx -t && echo "✓ Nginx config valid" || {
    echo "✗ Nginx config invalid"
    exit 1
}

# Restart nginx
echo "Restarting nginx..."
systemctl restart nginx

# Test external access
echo "Testing external access..."
sleep 5
EXTERNAL_TEST=$(curl -s -w "%{http_code}" https://score.ramisetty.net/api/teams 2>/dev/null || echo "000")
EXTERNAL_CODE="${EXTERNAL_TEST: -3}"

if [ "$EXTERNAL_CODE" = "200" ]; then
    echo "✅ SUCCESS! Application is working"
    echo "✓ Local access: http://localhost:3000"
    echo "✓ External access: https://score.ramisetty.net"
    echo ""
    echo "Application status:"
    pm2 list
else
    echo "✗ External access failing (HTTP $EXTERNAL_CODE)"
    echo "Checking nginx logs..."
    tail -20 /var/log/nginx/error.log
    echo ""
    echo "Checking PM2 logs..."
    pm2 logs cricket-scorer --lines 20
fi