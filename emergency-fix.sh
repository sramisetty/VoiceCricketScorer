#!/bin/bash

# Emergency fix for Cricket Scorer - complete service failure

set -e

SERVER_IP="67.227.251.94"
APP_DIR="/opt/cricket-scorer"

echo "=== EMERGENCY FIX: Complete Service Failure ==="

# Create comprehensive emergency fix script
cat > /tmp/emergency-fix.sh << 'EOFFIX'
#!/bin/bash

APP_DIR="/opt/cricket-scorer"
APP_USER="cricket-scorer"

echo "=== Emergency Diagnostic ==="

echo "1. Check if PM2 process is running:"
sudo -u $APP_USER pm2 status || echo "PM2 not responding"

echo "2. Check if Node.js process exists:"
ps aux | grep -E "(node|cricket)" | grep -v grep || echo "No Node processes found"

echo "3. Check if port 3000 is listening:"
netstat -tlnp | grep :3000 || echo "Port 3000 not listening"

echo "4. Check Nginx status:"
systemctl status nginx --no-pager -l

echo "5. Check Nginx error logs:"
tail -20 /var/log/nginx/error.log

echo "6. Check if app directory exists:"
ls -la $APP_DIR/ || echo "App directory missing"

echo "7. Check if built server exists:"
ls -la $APP_DIR/dist/index.js || echo "Built server missing"

echo "=== Emergency Recovery ==="

echo "8. Stopping all processes..."
sudo -u $APP_USER pm2 stop all || true
sudo -u $APP_USER pm2 delete all || true

echo "9. Rebuilding application..."
cd $APP_DIR

# Build server
echo "Building server..."
sudo -u $APP_USER npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# Build client to server/public
echo "Building client to server/public..."
sudo -u $APP_USER NODE_ENV=production npx vite build --outDir server/public --emptyOutDir

# Verify builds
echo "10. Verifying builds..."
if [ ! -f "$APP_DIR/dist/index.js" ]; then
    echo "ERROR: Server build failed!"
    exit 1
fi

if [ ! -f "$APP_DIR/server/public/index.html" ]; then
    echo "ERROR: Client build failed!"
    exit 1
fi

echo "Server file size: $(ls -lh $APP_DIR/dist/index.js | awk '{print $5}')"
echo "Client assets:"
ls -la $APP_DIR/server/public/assets/ || echo "No assets directory"

echo "11. Setting permissions..."
chown -R $APP_USER:$APP_USER $APP_DIR/dist/
chown -R $APP_USER:$APP_USER $APP_DIR/server/public/
chmod -R 755 $APP_DIR/dist/
chmod -R 755 $APP_DIR/server/public/

echo "12. Starting application..."
cd $APP_DIR
sudo -u $APP_USER pm2 start ecosystem.config.cjs

echo "13. Waiting for startup..."
sleep 5

echo "14. Testing local server..."
curl -I http://localhost:3000/ || echo "Local server not responding"

echo "15. Checking PM2 status..."
sudo -u $APP_USER pm2 status

echo "16. Checking recent logs..."
sudo -u $APP_USER pm2 logs cricket-scorer --lines 10

echo "17. Restarting Nginx..."
systemctl restart nginx

echo "18. Final test..."
curl -I http://localhost:80/ || echo "Nginx not responding"

echo "=== Recovery Complete ==="
EOFFIX

echo "Executing emergency fix on production server..."

# Copy and run the emergency fix
scp -o StrictHostKeyChecking=no /tmp/emergency-fix.sh root@$SERVER_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "chmod +x /tmp/emergency-fix.sh && /tmp/emergency-fix.sh"

echo ""
echo "=== Final Verification ==="
echo "Testing main site:"
curl -I https://score.ramisetty.net/

echo ""
echo "Testing specific asset:"
curl -I https://score.ramisetty.net/assets/index-BdSldNSL.css

echo ""
echo "=== Emergency Fix Complete ==="
echo "Visit https://score.ramisetty.net to verify the Cricket Scorer is working"

# Cleanup
rm -f /tmp/emergency-fix.sh