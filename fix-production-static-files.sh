#!/bin/bash

# Fix production static file serving for Cricket Scorer
# This script addresses the 404 errors for static assets

set -e

SERVER_IP="67.227.251.94"
APP_DIR="/opt/cricket-scorer"
APP_USER="cricket-scorer"

echo "=== Fixing Production Static File Serving ==="

# Create a script to run on the production server
cat > /tmp/fix-static-files.sh << 'EOF'
#!/bin/bash

APP_DIR="/opt/cricket-scorer"
APP_USER="cricket-scorer"

echo "Current directory structure:"
ls -la $APP_DIR/

echo "Dist directory contents:"
ls -la $APP_DIR/dist/ 2>/dev/null || echo "dist directory not found"

echo "Public directory contents:"
ls -la $APP_DIR/dist/public/ 2>/dev/null || echo "public directory not found"

# Check if build files exist
if [ ! -d "$APP_DIR/dist/public" ]; then
    echo "Creating dist/public directory..."
    mkdir -p $APP_DIR/dist/public
    chown -R $APP_USER:$APP_USER $APP_DIR/dist
fi

# Rebuild the application if static files are missing
if [ ! -f "$APP_DIR/dist/public/index.html" ]; then
    echo "Static files missing. Rebuilding application..."
    cd $APP_DIR
    
    # Build client
    sudo -u $APP_USER NODE_ENV=production npm run build:client
    
    # Verify build output
    echo "Build verification:"
    ls -la $APP_DIR/dist/public/
    
    # Check if assets directory exists
    if [ -d "$APP_DIR/dist/public/assets" ]; then
        echo "Assets directory contents:"
        ls -la $APP_DIR/dist/public/assets/
    fi
fi

# Fix file permissions
chown -R $APP_USER:$APP_USER $APP_DIR/dist/
chmod -R 755 $APP_DIR/dist/

# Check PM2 status
echo "PM2 Status:"
sudo -u $APP_USER pm2 status

# Check if the application is running with correct working directory
echo "PM2 Process Details:"
sudo -u $APP_USER pm2 show cricket-scorer

# Restart PM2 application
echo "Restarting PM2 application..."
sudo -u $APP_USER pm2 restart cricket-scorer

# Test static file serving
echo "Testing static file access:"
curl -I http://localhost:3000/assets/ 2>/dev/null || echo "Assets endpoint not accessible"

echo "=== Fix completed ==="
EOF

# Copy script to server and execute
scp -o StrictHostKeyChecking=no /tmp/fix-static-files.sh root@$SERVER_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$SERVER_IP "chmod +x /tmp/fix-static-files.sh && /tmp/fix-static-files.sh"

echo "Production static file fix completed!"

# Clean up
rm -f /tmp/fix-static-files.sh

echo "You can now test the application at https://score.ramisetty.net"