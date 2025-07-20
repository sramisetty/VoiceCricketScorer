#!/bin/bash

# Quick fix for Cricket Scorer production static asset 404 errors
# This directly addresses the asset serving problem

set -e

SERVER_IP="67.227.251.94"
APP_DIR="/opt/cricket-scorer"

echo "=== Quick Fix: Static Asset 404 Errors ==="

# Create the fix script
cat > /tmp/quick-fix.sh << 'EOFFIX'
#!/bin/bash

APP_DIR="/opt/cricket-scorer"
APP_USER="cricket-scorer"

echo "1. Checking current build output..."
ls -la $APP_DIR/dist/public/ 2>/dev/null || echo "public directory missing"
ls -la $APP_DIR/dist/public/assets/ 2>/dev/null || echo "assets directory missing"

echo "2. Stopping PM2..."
sudo -u $APP_USER pm2 stop cricket-scorer || true

echo "3. Rebuilding client with explicit output..."
cd $APP_DIR
sudo -u $APP_USER NODE_ENV=production npx vite build --outDir dist/public --emptyOutDir

echo "4. Verifying assets exist..."
if [ ! -d "$APP_DIR/dist/public/assets" ]; then
    echo "ERROR: Assets directory still missing after build!"
    exit 1
fi

echo "Assets created:"
ls -la $APP_DIR/dist/public/assets/

echo "5. Setting permissions..."
chown -R $APP_USER:$APP_USER $APP_DIR/dist/
chmod -R 755 $APP_DIR/dist/

echo "6. Testing asset accessibility..."
# Check if we can read the assets
for asset in $APP_DIR/dist/public/assets/*; do
    if [ -f "$asset" ]; then
        echo "Asset found: $(basename $asset) - $(ls -lh $asset | awk '{print $5}')"
    fi
done

echo "7. Starting PM2 with correct working directory..."
cd $APP_DIR
sudo -u $APP_USER pm2 start ecosystem.config.cjs

echo "8. Testing local asset serving..."
sleep 2
curl -I http://localhost:3000/ || echo "Local server not responding"

echo "9. Reloading nginx..."
systemctl reload nginx

echo "Fix completed!"
EOFFIX

# Execute on production server
chmod +x /tmp/quick-fix.sh

echo "Executing quick fix on production server..."

# Copy and run the fix
scp -o StrictHostKeyChecking=no /tmp/quick-fix.sh root@$SERVER_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "chmod +x /tmp/quick-fix.sh && /tmp/quick-fix.sh"

echo ""
echo "=== Testing Fixed Application ==="
echo "1. Main page:"
curl -I https://score.ramisetty.net/

echo ""
echo "2. Testing CSS asset:"
curl -I https://score.ramisetty.net/assets/index-BdSldNSL.css

echo ""
echo "3. Testing JS asset:"
curl -I https://score.ramisetty.net/assets/index-CPbDgN6S.js

echo ""
echo "=== Fix Complete ==="
echo "Visit https://score.ramisetty.net to test the Cricket Scorer application"
echo "The React app should now load properly with working voice commands"

# Cleanup
rm -f /tmp/quick-fix.sh