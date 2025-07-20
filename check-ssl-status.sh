#!/bin/bash

# Check SSL Status for Cricket Scorer
# Quick diagnostic script to verify SSL installation

DOMAIN="score.ramisetty.net"

echo "=== SSL Status Check for $DOMAIN ==="
echo ""

echo "1. Certificate Status:"
certbot certificates | grep -A 10 $DOMAIN || echo "Certificate not found"
echo ""

echo "2. Nginx Configuration Test:"
nginx -t
echo ""

echo "3. Nginx Server Blocks:"
nginx -T 2>/dev/null | grep -A 5 -B 5 "server_name.*$DOMAIN" || echo "No matching server block found"
echo ""

echo "4. SSL Certificate Files:"
ls -la /etc/letsencrypt/live/$DOMAIN/ 2>/dev/null || echo "Certificate files not found"
echo ""

echo "5. Testing HTTPS Connection:"
curl -I https://$DOMAIN 2>/dev/null | head -1 || echo "HTTPS connection failed"
echo ""

echo "6. PM2 Application Status:"
sudo -u cricketapp pm2 status cricket-scorer 2>/dev/null || echo "PM2 status unavailable"
echo ""

echo "=== End Status Check ==="