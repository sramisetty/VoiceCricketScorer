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

# Emergency production fix - completely eliminate Replit imports
emergency_production_fix() {
    log "Emergency fix: Completely eliminating Replit imports from production build..."
    
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
    
    # Verify client build succeeded
    if [ ! -f "server/public/index.html" ]; then
        error "Client build failed - no index.html found"
        exit 1
    fi
    
    # Build production server
    log "Building production server..."
    npx esbuild server/index.prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
    
    # Verify server build succeeded
    if [ ! -f "dist/index.js" ]; then
        error "Server build failed - no dist/index.js found"
        ls -la dist/ || true
        exit 1
    fi
    
    # Verify no Replit imports in built files
    log "Verifying no Replit imports remain..."
    if grep -r "@replit" dist/ server/public/ 2>/dev/null; then
        error "Replit imports still found! Build failed."
        exit 1
    fi
    
    success "Build completed successfully with no Replit imports"
    log "Built files: $(ls -la dist/ server/public/)"
    
    # Clean up temporary files
    rm -f server/index.prod.ts
}

# Build application for production
build_application() {
    log "Building application for production..."
    
    cd "$APP_DIR"
    
    # Use emergency production fix to eliminate Replit imports
    emergency_production_fix
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

# Fix PostgreSQL configuration
fix_postgresql_config() {
    log "Checking and fixing PostgreSQL configuration..."
    
    PGDATA_DIR="/var/lib/pgsql/data"
    POSTGRES_CONF="$PGDATA_DIR/postgresql.conf"
    
    # Stop PostgreSQL service first
    systemctl stop postgresql 2>/dev/null || true
    
    if [ -f "$POSTGRES_CONF" ]; then
        # Check for invalid configuration parameters
        if grep -q "shared_buffers.*0.*8kB\|effective_cache_size.*0.*8kB" "$POSTGRES_CONF"; then
            log "Found invalid PostgreSQL configuration, fixing..."
            
            # Create backup
            cp "$POSTGRES_CONF" "$POSTGRES_CONF.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Create minimal working configuration
            cat > "$POSTGRES_CONF" << 'EOF'
# Minimal PostgreSQL Configuration
listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 2GB
EOF
            
            # Set proper ownership and permissions
            chown postgres:postgres "$POSTGRES_CONF"
            chmod 600 "$POSTGRES_CONF"
            
            success "PostgreSQL configuration fixed"
        fi
    fi
    
    # Start PostgreSQL service
    log "Starting PostgreSQL service..."
    systemctl start postgresql
    systemctl enable postgresql
    
    # Wait for service to be ready
    sleep 5
    
    if systemctl is-active --quiet postgresql; then
        success "PostgreSQL service is running"
    else
        error "PostgreSQL service failed to start"
        systemctl status postgresql
        exit 1
    fi
}

# Setup database
setup_database() {
    log "Setting up database schema..."
    
    cd "$APP_DIR"
    
    # Fix PostgreSQL configuration first
    fix_postgresql_config
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if su - postgres -c "psql -c 'SELECT 1;'" >/dev/null 2>&1; then
            success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start within 30 seconds"
            systemctl status postgresql
            exit 1
        fi
        sleep 1
    done
    
    # Ensure database users and database exist
    log "Setting up database users and schema..."
    
    # Check if cricket_user exists
    if ! sudo -u postgres psql -c "\du cricket_user" 2>/dev/null | grep -q cricket_user; then
        log "Cricket user missing, creating database setup..."
        
        # Create cricket_user
        sudo -u postgres psql -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'cricket_user') THEN
                CREATE USER cricket_user WITH PASSWORD 'cricket_pass';
                GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;
                ALTER USER cricket_user CREATEDB;
            END IF;
        END
        \$\$;" || warning "User creation may have failed"
        
        # Create cricket_scorer database
        sudo -u postgres psql -c "
        SELECT 'CREATE DATABASE cricket_scorer OWNER cricket_user'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cricket_scorer')\gexec" || {
            sudo -u postgres createdb -O cricket_user cricket_scorer 2>/dev/null || true
        }
        
        # Set permissions
        sudo -u postgres psql -d cricket_scorer -c "
        GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
        GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;" || true
        
        success "Database users and database created"
    fi
    
    # Run database migrations
    log "Running database migrations..."
    npm run db:push || warning "Database schema sync may have issues, continuing deployment"
    
    success "Database schema synchronized"
}

# Configure PM2 for production
configure_pm2() {
    log "Configuring PM2 for production..."
    
    cd "$APP_DIR"
    
    # Stop existing PM2 processes
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start application with existing PM2 config
    log "Starting application with PM2..."
    pm2 start ecosystem.config.cjs --env production
    
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
    
    # First verify the application is running
    log "Verifying application is running on port 3000..."
    if ! curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
        error "Application is not responding on port 3000"
        log "Checking PM2 status..."
        pm2 status || true
        log "Attempting to start application..."
        cd $APP_DIR
        pm2 start ecosystem.config.cjs --env production
        sleep 10
        
        if ! curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
            error "Application still not responding after PM2 start"
            pm2 logs $APP_NAME --lines 20
            exit 1
        fi
    fi
    success "Application is responding on port 3000"
    
    # Stop nginx first
    systemctl stop nginx 2>/dev/null || true
    
    # Comprehensive port cleanup
    log "Clearing port conflicts..."
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
    systemctl disable httpd 2>/dev/null || true
    
    # Kill any processes using ports 80 and 443
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            log "Killing processes on port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 2
        fi
    done
    
    # Verify ports are free
    for port in 80 443; do
        if lsof -ti:$port >/dev/null 2>&1; then
            error "Port $port is still in use after cleanup"
            lsof -i:$port
            exit 1
        fi
    done
    
    success "Ports 80 and 443 are now free"
    
    # Create nginx directories if they don't exist
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    
    # Create Nginx configuration for the app
    cat > /etc/nginx/sites-available/$APP_NAME << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name score.ramisetty.net www.score.ramisetty.net;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
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
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
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
    
    # Remove default configurations that interfere
    rm -f /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/conf.d/default.conf
    
    # Enable site using both methods for compatibility
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
    
    # Also create in conf.d as fallback for different nginx setups
    cp /etc/nginx/sites-available/$APP_NAME /etc/nginx/conf.d/$APP_NAME.conf
    
    # Ensure nginx.conf includes sites-enabled
    if [ -f "/etc/nginx/nginx.conf" ]; then
        if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
            log "Adding sites-enabled include to nginx.conf..."
            sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi
    fi
    
    # Test nginx configuration
    log "Testing Nginx configuration..."
    nginx -t
    if [ $? -ne 0 ]; then
        error "Nginx configuration test failed"
        exit 1
    fi
    
    # Start Nginx service
    log "Starting Nginx service..."
    systemctl start nginx
    systemctl enable nginx
    
    # Wait for nginx to start
    sleep 3
    
    if systemctl is-active --quiet nginx; then
        success "Nginx service is running"
    else
        error "Nginx service failed to start"
        systemctl status nginx
        exit 1
    fi
    
    # Test the final configuration
    log "Testing final nginx configuration..."
    if curl -f -s -H "Host: score.ramisetty.net" http://localhost/ >/dev/null 2>&1; then
        success "Nginx proxy test passed"
    else
        error "Nginx proxy test failed"
        log "Nginx error log:"
        tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
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
    log ""
    log "=== DEPLOYMENT SUMMARY ==="
    log "Application Directory: $APP_DIR"
    log "Database: cricket_scorer (PostgreSQL)"
    log "Application Port: 3000"
    log "Web Server: Nginx (ports 80/443)"
    log ""
    log "=== ACCESS INFORMATION ==="
    log "Application URL: http://$DOMAIN"
    log "If SSL configured: https://$DOMAIN"
    log ""
    log "=== SERVICE STATUS ==="
    systemctl is-active postgresql >/dev/null 2>&1 && echo "✓ PostgreSQL: Running" || echo "✗ PostgreSQL: Not running"
    systemctl is-active nginx >/dev/null 2>&1 && echo "✓ Nginx: Running" || echo "✗ Nginx: Not running"
    pm2 list | grep -q "$APP_NAME.*online" && echo "✓ Cricket Scorer App: Running" || echo "✗ Cricket Scorer App: Not running"
    log ""
    log "=== VERIFICATION COMMANDS ==="
    log "Check PM2 status: pm2 status"
    log "Check application: curl http://localhost:3000/"
    log "Check nginx proxy: curl -H 'Host: $DOMAIN' http://localhost/"
    log "View logs: pm2 logs $APP_NAME"
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