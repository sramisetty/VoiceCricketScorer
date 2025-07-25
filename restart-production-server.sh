#!/bin/bash

# restart-production-server.sh
# Restart the Cricket Scorer application in production

set -e

echo "========================================="
echo "Cricket Scorer - Server Restart"
echo "========================================="

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restarting Cricket Scorer application..."

# Check if PM2 is managing the app
if command -v pm2 >/dev/null 2>&1; then
    echo "Checking PM2 processes..."
    pm2 list
    
    echo "Restarting cricket-scorer with PM2..."
    pm2 restart cricket-scorer || {
        echo "PM2 restart failed, trying to start fresh..."
        pm2 start ecosystem.config.cjs
    }
    
    echo "Checking PM2 logs..."
    pm2 logs cricket-scorer --lines 20
    
else
    echo "PM2 not found, checking if server is running on port 3000..."
    
    # Kill any existing process on port 3000
    sudo lsof -ti:3000 | xargs -r sudo kill -9 || echo "No process found on port 3000"
    
    echo "Starting server directly..."
    nohup node dist/index.js > server.log 2>&1 &
    
    sleep 3
    
    echo "Checking if server started..."
    if curl -f http://localhost:3000/api/matches >/dev/null 2>&1; then
        echo "✓ Server started successfully"
    else
        echo "✗ Server failed to start or not responding"
        echo "Server log:"
        tail -20 server.log
    fi
fi

echo ""
echo "Testing API endpoints..."
curl -s -o /dev/null -w "Matches API: %{http_code}\n" http://localhost:3000/api/matches || echo "Matches API: Failed to connect"
curl -s -o /dev/null -w "Franchises API: %{http_code}\n" http://localhost:3000/api/franchises || echo "Franchises API: Failed to connect"
curl -s -o /dev/null -w "Teams API: %{http_code}\n" http://localhost:3000/api/teams || echo "Teams API: Failed to connect"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server restart completed"