#!/bin/bash

# Emergency Production Fix - Complete Replit Import Elimination
# This script creates a completely clean production build without any Replit dependencies

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
    exit 1
fi

APP_DIR="/opt/cricket-scorer"

log "Emergency fix: Completely eliminating Replit imports from production build..."

# Change to application directory
if [ ! -d "$APP_DIR" ]; then
    error "Application directory $APP_DIR not found"
    exit 1
fi

cd "$APP_DIR"

# Stop all PM2 processes
log "Stopping all PM2 processes..."
pm2 kill 2>/dev/null || true

# Remove ALL build artifacts and caches
log "Removing all build artifacts and caches..."
rm -rf dist/ server/public/ node_modules/.cache/ node_modules/.vite/
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Remove Replit packages completely
log "Removing Replit packages..."
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true

# Clean reinstall
log "Clean package reinstall..."
rm -rf node_modules/
npm install --production=false

# Create minimal production server without any Vite config imports
log "Creating production server without Vite config dependencies..."
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

# Build client using production config only
log "Building client with production config..."
export NODE_ENV=production
npx vite build --config vite.config.production.ts

# Build production server
log "Building production server..."
npx esbuild server/index.prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify no Replit imports in built files
log "Verifying no Replit imports remain..."
if grep -r "@replit" dist/ server/public/ 2>/dev/null; then
    error "Replit imports still found! Build failed."
    exit 1
fi

success "Build completed successfully with no Replit imports"

# Update PM2 configuration to use new build
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
      DATABASE_URL: process.env.DATABASE_URL
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
log "Starting application with PM2..."
pm2 start ecosystem.config.cjs --env production

# Wait for startup
sleep 15

# Test application response
log "Testing application response..."
for i in {1..10}; do
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application is responding on port 3000!"
        break
    fi
    if [ $i -eq 10 ]; then
        error "Application failed to respond after 10 attempts"
        log "PM2 status:"
        pm2 status
        log "PM2 logs:"
        pm2 logs cricket-scorer --lines 30
        exit 1
    fi
    sleep 3
done

# Show PM2 status
log "PM2 status:"
pm2 status

# Save PM2 configuration
pm2 save

success "Emergency fix completed! Application is running on port 3000."
log "Your cricket scorer should now be accessible without any Replit import errors."

# Clean up temporary files
rm -f server/index.prod.ts

success "Production deployment is ready for nginx configuration."