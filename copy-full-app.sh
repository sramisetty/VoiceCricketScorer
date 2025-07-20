#!/bin/bash

# Copy Full Cricket Scorer App from Replit to Production
# This script creates a complete deployment package

set -euo pipefail

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Creating complete Cricket Scorer deployment package..."

# Create deployment directory
mkdir -p cricket-scorer-deploy
cd cricket-scorer-deploy

# Copy all necessary files from current project
cp -r ../client ./
cp -r ../server ./
cp -r ../shared ./
cp ../package.json ./
cp ../package-lock.json ./
cp ../tsconfig.json ./
cp ../vite.config.ts ./
cp ../tailwind.config.ts ./
cp ../postcss.config.js ./
cp ../drizzle.config.ts ./
cp ../components.json ./

# Create ecosystem config for production
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    cwd: '/home/cricketapp/cricket-scorer',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: process.env.DATABASE_URL
    },
    max_memory_restart: '500M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    merge_logs: true
  }]
}
EOF

# Create production deployment script
cat > deploy-on-production.sh << 'EOF'
#!/bin/bash

# Run this script on your production server after copying files

set -euo pipefail

APP_DIR="/home/cricketapp/cricket-scorer"

echo "Setting up Cricket Scorer on production server..."

# Stop existing PM2 process
sudo -u cricketapp pm2 stop cricket-scorer 2>/dev/null || true
sudo -u cricketapp pm2 delete cricket-scorer 2>/dev/null || true

# Install dependencies
sudo -u cricketapp npm install

# Build the application
sudo -u cricketapp npm run build

# Start with PM2
sudo -u cricketapp pm2 start ecosystem.config.cjs
sudo -u cricketapp pm2 save

# Test the application
sleep 5
curl -s http://localhost:5000/api/health || echo "Health check failed"

echo "Cricket Scorer deployment complete!"
EOF

chmod +x deploy-on-production.sh

# Create tar archive for easy transfer
cd ..
tar -czf cricket-scorer-production.tar.gz cricket-scorer-deploy/

log "✓ Created cricket-scorer-production.tar.gz"
log "✓ Transfer this file to your production server and extract it"
log ""
log "Commands to run on production server:"
log "1. scp cricket-scorer-production.tar.gz root@67.227.251.94:/tmp/"
log "2. ssh root@67.227.251.94"
log "3. cd /home/cricketapp && tar -xzf /tmp/cricket-scorer-production.tar.gz"
log "4. cd cricket-scorer-deploy && sudo ./deploy-on-production.sh"