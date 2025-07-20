#!/bin/bash

# Simple Production Cricket Scorer App
# Creates a minimal working version to get the site live quickly

set -euo pipefail

APP_DIR="/opt/cricket-scorer"

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

log "Creating simple Cricket Scorer production app..."

# Stop existing PM2 process
sudo -u cricketapp pm2 stop cricket-scorer 2>/dev/null || true
sudo -u cricketapp pm2 delete cricket-scorer 2>/dev/null || true

cd $APP_DIR

# Create minimal working Express app
cat > dist/index.js << 'EOF'
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    app: 'Cricket Scorer Production'
  });
});

app.get('/api/teams', (req, res) => {
  res.json([
    { id: 1, name: "Mumbai Indians", shortName: "MI" },
    { id: 2, name: "Chennai Super Kings", shortName: "CSK" },
    { id: 3, name: "Royal Challengers Bangalore", shortName: "RCB" },
    { id: 4, name: "Kolkata Knight Riders", shortName: "KKR" }
  ]);
});

app.get('/api/matches', (req, res) => {
  res.json([
    { 
      id: 1, 
      team1Id: 1, 
      team2Id: 2, 
      status: "upcoming",
      venue: "Wankhede Stadium",
      date: new Date().toISOString()
    }
  ]);
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cricket Scorer - Production</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Arial, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }
            .container { 
                text-align: center; 
                padding: 3rem;
                background: rgba(255,255,255,0.1);
                border-radius: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 25px 50px rgba(0,0,0,0.2);
                max-width: 500px;
            }
            h1 { 
                font-size: 3rem; 
                margin-bottom: 1rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .emoji { font-size: 4rem; margin-bottom: 1rem; }
            p { 
                font-size: 1.2rem; 
                margin-bottom: 1rem;
                opacity: 0.9;
            }
            .status { 
                background: rgba(34, 197, 94, 0.2);
                padding: 0.5rem 1rem;
                border-radius: 25px;
                display: inline-block;
                margin: 1rem 0;
                border: 1px solid rgba(34, 197, 94, 0.3);
            }
            .api-test {
                margin-top: 2rem;
                padding: 1rem;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                font-family: monospace;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="emoji">🏏</div>
            <h1>Cricket Scorer</h1>
            <div class="status">✅ Production Server Online</div>
            <p>Voice-Enabled Cricket Scoring Platform</p>
            <p>Server Time: ${new Date().toLocaleString()}</p>
            <div class="api-test">
                <strong>API Status:</strong><br>
                <a href="/api/health" style="color: #90EE90;">/api/health</a> |
                <a href="/api/teams" style="color: #90EE90;">/api/teams</a> |
                <a href="/api/matches" style="color: #90EE90;">/api/matches</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(\`🏏 Cricket Scorer serving on port \${port}\`);
  console.log(\`📅 Started at: \${new Date().toLocaleString()}\`);
});
EOF

# Create simple package.json
cat > package.json << 'EOF'
{
  "name": "cricket-scorer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install minimal dependencies
sudo -u cricketapp npm install

# Start with PM2
log "Starting simple Cricket Scorer with PM2..."
sudo -u cricketapp pm2 start ecosystem.config.cjs
sudo -u cricketapp pm2 save

# Test the application
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ Cricket Scorer is live!"
    log "🌐 Visit: https://score.ramisetty.net"
    log "🔍 API Health: https://score.ramisetty.net/api/health"
else
    log "⚠️ Checking PM2 logs..."
    sudo -u cricketapp pm2 logs cricket-scorer --lines 10
fi

sudo -u cricketapp pm2 status

log "🏏 Simple Cricket Scorer deployment completed!"