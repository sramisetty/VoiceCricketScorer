#!/bin/bash

# Deploy Cricket Scorer to Production Server
# Run this script on your production server (67.227.251.94)

set -euo pipefail

DOMAIN="score.ramisetty.net"
APP_DIR="/opt/cricket-scorer"
REPO_URL="https://github.com/sramisetty/cricket-scorer.git"  # Update with your actual repo

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Deploying Cricket Scorer to production..."

# Create cricketapp user if it doesn't exist
if ! id "cricketapp" &>/dev/null; then
    useradd -m -s /bin/bash cricketapp
    log "✓ Created cricketapp user"
fi

# Install Node.js and PM2 if not present
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
fi

# Create application directory
mkdir -p $APP_DIR
cd $APP_DIR

# Deploy the application (you can copy files or use git)
log "Setting up application files..."

# Create package.json
cat > package.json << 'EOF'
{
  "name": "cricket-scorer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "NODE_ENV=production node dist/index.js",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
  }
}
EOF

# Create ecosystem.config.cjs for PM2
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    cwd: '/opt/cricket-scorer',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000'
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

# Create a simple dist/index.js for testing
mkdir -p dist
cat > dist/index.js << 'EOF'
import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

app.get('/', (req, res) => {
  res.send('<h1>Cricket Scorer</h1><p>Production server running!</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`Cricket Scorer serving on port ${port}`);
});
EOF

# Set ownership
chown -R cricketapp:cricketapp $APP_DIR

# Start with PM2
log "Starting Cricket Scorer with PM2..."
sudo -u cricketapp pm2 start ecosystem.config.cjs
sudo -u cricketapp pm2 save
sudo -u cricketapp pm2 startup

# Test the application
sleep 3
if curl -s http://localhost:5000/health >/dev/null; then
    log "✓ Cricket Scorer is running on port 5000"
else
    warn "Application might not be responding yet"
fi

# Configure Nginx
log "Configuring Nginx..."
cat > /etc/nginx/conf.d/cricket-scorer.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:5000;
        access_log off;
    }
}
EOF

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Configure SSL
log "Setting up SSL..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN --redirect

log "✓ Production deployment completed!"
log "🏏 Cricket Scorer is available at: https://$DOMAIN"