#!/bin/bash

# Run this script on your production server after copying files

set -euo pipefail

APP_DIR="/opt/cricket-scorer"

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
