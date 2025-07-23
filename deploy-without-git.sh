#!/bin/bash

# Cricket Scorer Deployment (Without Git Operations)
# Use this when you already have the latest code and just need to build/deploy

set -e

# Configuration
APP_DIR="/opt/cricket-scorer"
LOG_FILE="/var/log/cricket-scorer-deploy.log"

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1" | tee -a "$LOG_FILE"
}

# Check if we're in the right directory
if [ ! -d "$APP_DIR" ]; then
    error "Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

log "Starting Cricket Scorer deployment (without git operations)..."

# Install dependencies
log "Installing dependencies..."
rm -rf node_modules/ 2>/dev/null || true
npm install --production=false
npm install terser --save-dev

# Build client for production
log "Building client application..."
export NODE_ENV=production
npx vite build --config vite.config.production.ts

# Verify client build
if [ ! -f "server/public/index.html" ]; then
    error "Client build failed - no index.html found"
    exit 1
fi

# Create production server file
log "Creating production server..."
cat > server/index.prod.ts << 'EOF'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      console.log(`${formattedTime} [express] ${logLine}`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from server/public
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [express] serving on port ${PORT}`);
  });
})();
EOF

# Build server
log "Building server..."
npx esbuild server/index.prod.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

# Verify server build
if [ ! -f "dist/index.js" ]; then
    error "Server build failed"
    exit 1
fi

# Setup environment
log "Setting up environment..."
# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ] && [ -f ".env" ]; then
    OPENAI_API_KEY=$(grep "OPENAI_API_KEY=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
fi

if [ ! -f ".env" ]; then
    cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
OPENAI_API_KEY=${OPENAI_API_KEY:-""}
NODE_ENV=production
PORT=3000
EOF
fi

# Update PM2 ecosystem config
log "Updating PM2 configuration..."
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer',
      OPENAI_API_KEY: '${OPENAI_API_KEY:-""}'
    },
    error_file: '/var/log/cricket-scorer-error.log',
    out_file: '/var/log/cricket-scorer-out.log',
    log_file: '/var/log/cricket-scorer.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100
  }]
};
EOF

# Run database schema refresh if script exists
if [ -f "refresh-production-schema.sh" ]; then
    log "Running database schema refresh..."
    ./refresh-production-schema.sh
else
    log "No schema refresh script found, skipping..."
fi

# Restart PM2 application
log "Restarting PM2 application..."
pm2 kill 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Wait for application to start
log "Waiting for application to start..."
sleep 10

# Test application
log "Testing application..."
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    success "✓ Application is responding"
    
    # Show PM2 status
    pm2 list
    
    success "Cricket Scorer deployment completed successfully!"
    log "Application available at: http://localhost:3000"
    log "PM2 logs: pm2 logs cricket-scorer"
    log "PM2 status: pm2 status"
else
    error "✗ Application not responding"
    pm2 logs cricket-scorer --lines 20
    exit 1
fi