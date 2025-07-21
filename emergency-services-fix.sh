#!/bin/bash

# Emergency Services Fix - Clean Production Build
# Fixes Replit dependency issues in production deployment

set -e

APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Clean production build without Replit dependencies
clean_production_build() {
    log "Creating clean production build without Replit dependencies..."
    
    cd "$APP_DIR"
    
    # Remove existing builds
    rm -rf dist/ server/public/ 2>/dev/null || true
    
    # Remove Replit-specific packages
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    # Clean install production dependencies
    log "Installing clean production dependencies..."
    rm -rf node_modules package-lock.json 2>/dev/null || true
    npm install --production=false
    
    # Create clean Vite config without any Replit dependencies
    log "Creating clean Vite configuration..."
    cat > vite.config.clean.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  },
  root: './client'
});
EOF
    
    # Clean up client HTML file (remove Replit script)
    log "Cleaning client HTML file..."
    sed -i '/<script.*replit-dev-banner\.js/d' client/index.html
    
    # Build client with clean config
    log "Building client application with clean configuration..."
    cd client
    NODE_ENV=production npx vite build --config ../vite.config.clean.ts --mode production
    cd ..
    
    # Verify client build
    if [ ! -f "server/public/index.html" ]; then
        error "Client build failed"
        exit 1
    fi
    success "Client build completed successfully"
    
    # Create clean server build configuration
    log "Building server application with clean configuration..."
    
    # Create temporary clean server entry point
    cat > server/index.clean.ts << 'EOF'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
import './routes.js';

// Catch-all handler for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
EOF
    
    # Build server with clean entry point
    npx esbuild server/index.clean.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --outfile=dist/index.js \
        --packages=external \
        --format=esm \
        --minify \
        --sourcemap=false \
        --define:process.env.NODE_ENV=\"production\"
    
    # Clean up temporary files
    rm -f server/index.clean.ts vite.config.clean.ts
    
    if [ ! -f "dist/index.js" ]; then
        error "Server build failed"
        exit 1
    fi
    
    success "Clean production build completed successfully"
}

# Test clean application
test_clean_application() {
    log "Testing clean application..."
    
    cd "$APP_DIR"
    
    # Set environment variables
    export NODE_ENV=production
    export PORT=3000
    export DATABASE_URL="postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer"
    
    # Test application startup
    timeout 10s node dist/index.js &
    APP_PID=$!
    
    sleep 5
    
    # Check if it responds
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Clean application responds successfully"
        kill $APP_PID 2>/dev/null || true
        return 0
    else
        warning "Application still not responding"
        kill $APP_PID 2>/dev/null || true
        return 1
    fi
}

# Deploy clean application
deploy_clean_application() {
    log "Deploying clean application with PM2..."
    
    cd "$APP_DIR"
    
    # Stop existing processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Create clean ecosystem config
    cat > ecosystem.clean.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:cricket_pass@localhost:5432/cricket_scorer'
    }
  }]
};
EOF
    
    # Start with clean config
    pm2 start ecosystem.clean.cjs --env production
    pm2 save
    
    # Wait for startup
    sleep 10
    
    # Verify PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Clean application deployed successfully with PM2"
    else
        error "PM2 deployment failed"
        pm2 logs $APP_NAME --lines 20
        return 1
    fi
}

# Verify final deployment
verify_final_deployment() {
    log "Verifying final deployment..."
    
    # Test application
    if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application responding on localhost:3000"
    else
        error "Application not responding"
        return 1
    fi
    
    # Test Nginx proxy
    if curl -f -s http://localhost/ >/dev/null 2>&1; then
        success "Nginx proxy working"
    else
        warning "Nginx may need restart"
        systemctl restart nginx
    fi
    
    # Show final status
    log "Final deployment status:"
    pm2 status
    
    success "Emergency services fix completed!"
    log "Application should be accessible at: http://$DOMAIN"
}

# Main execution
main() {
    log "Starting emergency services fix..."
    
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
    
    clean_production_build
    
    if test_clean_application; then
        deploy_clean_application
        verify_final_deployment
    else
        error "Clean application test failed"
        exit 1
    fi
    
    success "Emergency services fix completed successfully!"
}

main "$@"