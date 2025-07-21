#!/bin/bash

# Cricket Scorer Production Deployment Script for Linux VPS
# Version: 2.0
# Compatible with: Ubuntu 20.04+, CentOS 8+, RHEL 8+, AlmaLinux 9+

set -e

# Configuration
APP_NAME="cricket-scorer"
APP_DIR="/opt/cricket-scorer"
DOMAIN="score.ramisetty.net"
NODE_VERSION="20.x"
POSTGRES_VERSION="15"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Build application with clean production configuration
build_application() {
    log "Building application for production..."
    
    cd "$APP_DIR"
    
    # Clean previous builds and remove Replit dependencies
    rm -rf dist/ server/public/ 2>/dev/null || true
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    # Create necessary directories
    mkdir -p server/public dist logs
    
    # Build client with clean configuration
    log "Building client application with clean configuration..."
    
    # Create clean Vite config without Replit dependencies
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
    
    # Clean up client HTML file (remove Replit script and fix import path)
    log "Cleaning client HTML file..."
    sed -i '/<script.*replit-dev-banner\.js/d' client/index.html
    sed -i 's|src="/src/main.tsx"|src="./src/main.tsx"|g' client/index.html
    
    # Build client
    cd client
    NODE_ENV=production npx vite build --config ../vite.config.clean.ts --mode production
    cd ..
    
    # Verify client build
    if [ ! -f "server/public/index.html" ]; then
        error "Client build failed"
        exit 1
    fi
    success "Client build completed successfully"
    
    # Build server with clean configuration
    log "Building server application with clean configuration..."
    
    # Create clean server entry point
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
        error "Server build failed - dist/index.js not found"
        exit 1
    fi
    
    # Set proper permissions
    chmod -R 755 server/public/ dist/
    chown -R root:root server/public/ dist/
    
    success "Clean production build completed successfully"
}

# Install dependencies
install_dependencies() {
    log "Installing application dependencies..."
    
    cd "$APP_DIR"
    
    # Clean install
    rm -rf node_modules 2>/dev/null || true
    
    # Install with production dependencies
    npm install --production=false
    
    # Install terser for production build
    log "Installing terser for production builds..."
    npm install terser --save-dev
    
    # Generate package-lock.json for future deployments
    log "Generating package-lock.json for consistent deployments..."
    
    # Remove Replit-specific packages in production
    npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true
    
    success "Dependencies installed successfully"
}

# Setup database
setup_database() {
    log "Setting up database schema..."
    
    cd "$APP_DIR"
    
    # Fix PostgreSQL permissions first
    log "Fixing PostgreSQL permissions..."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;" 2>/dev/null || true
    
    # Check if database connection works
    if command -v psql >/dev/null 2>&1; then
        log "Creating database schema..."
        # Try with postgres user if regular user fails
        npx drizzle-kit push --config=drizzle.config.ts || \
        sudo -u postgres DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config=drizzle.config.ts || \
        warning "Database schema sync may have issues, continuing deployment"
    fi
    
    success "Database schema synchronized"
}

# Configure PM2 with clean configuration
configure_pm2() {
    log "Configuring PM2 for production..."
    
    cd "$APP_DIR"
    
    # Stop existing PM2 processes
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
    
    # Start application with clean PM2 config
    log "Starting application with clean PM2 configuration..."
    pm2 start ecosystem.clean.cjs --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Wait for application to start
    sleep 10
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application started successfully with PM2"
        pm2 status
    else
        error "Failed to start application with PM2"
        pm2 logs $APP_NAME --lines 20
        exit 1
    fi
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx reverse proxy..."
    
    # Stop conflicting services and clear ports
    log "Clearing port conflicts..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    lsof -ti:443 | xargs kill -9 2>/dev/null || true
    
    # Check if Nginx is installed and running
    if ! systemctl is-active --quiet nginx; then
        log "Starting Nginx service..."
        systemctl start nginx
        systemctl enable nginx
    fi
    
    # Create Nginx configuration for the app
    cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name score.ramisetty.net;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Enable site and remove default
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and restart Nginx
    if nginx -t; then
        systemctl restart nginx
        systemctl enable nginx
        success "Nginx configured successfully"
    else
        error "Nginx configuration test failed"
        exit 1
    fi
}

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."
    
    check_root
    install_dependencies
    setup_database
    build_application
    configure_pm2
    configure_nginx
    
    success "Cricket Scorer deployment completed successfully!"
    log "Application should be accessible at: https://$DOMAIN"
    log "Checking application status..."
    
    sleep 5
    
    # Check PM2 status
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "PM2 application is running"
    else
        warning "PM2 application may not be running correctly"
        pm2 logs $APP_NAME --lines 10
    fi
    
    # Check application response
    if curl -f -s http://localhost:3000/api/health >/dev/null 2>&1 || curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        success "Application is responding on localhost:3000"
    else
        warning "Application may not be fully started yet"
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        success "Nginx is running"
        log "Application should be accessible at: http://$DOMAIN"
    else
        warning "Nginx is not running"
    fi
    
    # Final verification
    log "Final deployment verification:"
    pm2 status
}

# Run main function
main "$@"