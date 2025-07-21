#!/bin/bash

# Fix Replit Import Issues for Production Deployment
# Removes Replit-specific packages and rebuilds the application cleanly

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

log "Fixing Replit import issues for production deployment..."

# Change to application directory
if [ ! -d "$APP_DIR" ]; then
    error "Application directory $APP_DIR not found"
    exit 1
fi

cd "$APP_DIR"

# Stop PM2 processes first
log "Stopping existing PM2 processes..."
pm2 stop cricket-scorer 2>/dev/null || true
pm2 delete cricket-scorer 2>/dev/null || true

# Remove Replit-specific packages that cause import errors
log "Removing Replit-specific packages..."
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true

# Clean all build artifacts completely
log "Cleaning build artifacts..."
rm -rf dist/ server/public/ node_modules/.cache/ node_modules/.vite/
# Also remove any cached TypeScript builds
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Reinstall dependencies without Replit packages
log "Reinstalling dependencies for production..."
npm install --production=false

# Create production server file without Replit imports
log "Creating production server configuration..."
cp server/vite.ts server/vite.production.ts

# Replace the import line in server/vite.production.ts to use production config
sed -i 's|import viteConfig from "../vite.config";|import viteConfig from "../vite.config.production";|g' server/vite.production.ts

# Create production server index without vite imports in production
cat > server/index.production.ts << 'EOF'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite.production";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

      log(logLine);
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

  // Only serve static files in production
  serveStatic(app);

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
EOF

# Build application using production config
log "Building application for VPS production..."
export NODE_ENV=production
npx vite build --config vite.config.production.ts && npx esbuild server/index.production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify build outputs exist
if [ ! -d "server/public" ]; then
    error "Client build failed - server/public directory not found"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    error "Server build failed - dist/index.js not found"
    exit 1
fi

success "Application built successfully"

# Verify no Replit imports remain in built files
log "Checking for remaining Replit imports..."
if grep -r "@replit" dist/ server/public/ 2>/dev/null; then
    error "Replit imports still found in built files"
    exit 1
fi

# Clean up temporary production files
rm -f server/vite.production.ts server/index.production.ts

success "No Replit imports found in built files"

# Start application with PM2
log "Starting application with PM2..."
pm2 start ecosystem.config.cjs --env production

# Wait for application to start
sleep 10

# Test if application is responding
log "Testing application response..."
for i in {1..10}; do
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application is responding on port 3000"
        break
    fi
    if [ $i -eq 10 ]; then
        error "Application failed to respond after 10 attempts"
        log "PM2 status:"
        pm2 status
        log "PM2 logs:"
        pm2 logs cricket-scorer --lines 20
        exit 1
    fi
    sleep 2
done

# Show PM2 status
log "PM2 status:"
pm2 status

success "Replit import issues fixed and application restarted!"
log "Application should now be accessible at: http://localhost:3000"