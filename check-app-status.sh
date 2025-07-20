#!/bin/bash

# Check Application Status
# Diagnostic script to verify Cricket Scorer is running

echo "=== Cricket Scorer Status Check ==="
echo ""

echo "1. PM2 Process Status:"
sudo -u cricketapp pm2 status 2>/dev/null || echo "PM2 not found or not running"
echo ""

echo "2. Port 5000 Status:"
netstat -tlnp | grep :5000 || echo "Port 5000 not listening"
echo ""

echo "3. Port 3000 Status:"
netstat -tlnp | grep :3000 || echo "Port 3000 not listening"
echo ""

echo "4. Direct App Test (port 5000):"
curl -s -I http://localhost:5000 | head -1 || echo "App not responding on port 5000"
echo ""

echo "5. Direct App Test (port 3000):"
curl -s -I http://localhost:3000 | head -1 || echo "App not responding on port 3000"
echo ""

echo "6. Current Nginx Configuration:"
grep -r "proxy_pass" /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null || echo "No proxy configuration found"
echo ""

echo "7. Nginx Status:"
systemctl status nginx --no-pager -l || echo "Nginx status unavailable"
echo ""

echo "=== End Status Check ==="