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
echo "=== Final Status ==="
echo "Application should be accessible at: https://score.ramisetty.net"
echo "If still showing test page, nginx may be caching or needs restart"
echo ""
echo "Quick fixes to try:"
echo "1. sudo systemctl reload nginx"
echo "2. sudo systemctl restart nginx"
echo "3. Clear browser cache"