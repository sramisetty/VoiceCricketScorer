#!/bin/bash

# Fix NPM Dependencies for Cricket Scorer Production

set -euo pipefail

APP_DIR="/home/cricketapp/cricket-scorer"

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Fixing NPM dependencies for Cricket Scorer..."

cd $APP_DIR

# Create simplified package.json without version conflicts
cat > package.json << 'EOF'
{
  "name": "cricket-scorer",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  }
}
EOF

# Clean install
rm -rf node_modules package-lock.json
sudo -u cricketapp npm install --legacy-peer-deps

log "✓ Dependencies installed successfully"

# Build the application
log "Building application..."
sudo -u cricketapp npm run build

# Restart PM2
log "Restarting Cricket Scorer with PM2..."
sudo -u cricketapp pm2 restart cricket-scorer 2>/dev/null || sudo -u cricketapp pm2 start ecosystem.config.cjs

# Test the application
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✓ Cricket Scorer is running successfully"
    log "🏏 Available at: https://score.ramisetty.net"
else
    log "Checking PM2 logs..."
    sudo -u cricketapp pm2 logs cricket-scorer --lines 10
fi

sudo -u cricketapp pm2 status

log "✓ NPM dependency fix completed!"