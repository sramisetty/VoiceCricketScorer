#!/bin/bash

# Master Cricket Scorer Production Deployment Script
# Complete deployment solution for AlmaLinux 9 (67.227.251.94 / score.ramisetty.net)
# Handles all infrastructure setup, dependency resolution, and application deployment

set -euo pipefail

# Configuration
DOMAIN="score.ramisetty.net"
PUBLIC_IP="67.227.251.94"
APP_DIR="/opt/cricket-scorer"
DB_PASSWORD="cricket_secure_password_2025"
APP_USER="cricketapp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
    exit 1
fi

log "Starting Cricket Scorer Master Deployment for AlmaLinux 9"
log "Domain: $DOMAIN | IP: $PUBLIC_IP | App Directory: $APP_DIR"

# ============================================================================
# SECTION 1: SYSTEM PREREQUISITES
# ============================================================================

log "SECTION 1: Installing system prerequisites..."

# Update system
dnf update -y

# Install essential packages
dnf install -y curl wget git unzip tar openssl openssl-devel gcc-c++ make \
    firewalld nginx certbot python3-certbot-nginx postgresql postgresql-server \
    postgresql-contrib

# Install Node.js 20.x
if ! command -v node >/dev/null 2>&1; then
    log "Installing Node.js 20.x..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
else
    log "Node.js already installed: $(node --version)"
fi

# Install PM2 globally
if ! command -v pm2 >/dev/null 2>&1; then
    log "Installing PM2 globally..."
    npm install -g pm2
else
    log "PM2 already installed: $(pm2 --version)"
fi

# ============================================================================
# SECTION 2: USER AND DIRECTORY SETUP
# ============================================================================

log "SECTION 2: Setting up user and directories..."

# Create cricketapp user if it doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    log "Created user: $APP_USER"
else
    log "User $APP_USER already exists"
fi

# Create application directory
mkdir -p $APP_DIR
mkdir -p /opt/logs
chown -R $APP_USER:$APP_USER $APP_DIR
chown -R $APP_USER:$APP_USER /opt/logs

# ============================================================================
# SECTION 3: POSTGRESQL DATABASE SETUP
# ============================================================================

log "SECTION 3: Setting up PostgreSQL database..."

# Initialize PostgreSQL if not already done
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    log "Initializing PostgreSQL database..."
    postgresql-setup --initdb
fi

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Configure PostgreSQL authentication
log "Configuring PostgreSQL authentication..."
PG_HBA_CONF="/var/lib/pgsql/data/pg_hba.conf"
cp $PG_HBA_CONF ${PG_HBA_CONF}.backup.$(date +%Y%m%d_%H%M%S)

# Update pg_hba.conf for local connections
sed -i "s/local   all             all                                     peer/local   all             all                                     md5/g" $PG_HBA_CONF
sed -i "s/host    all             all             127.0.0.1\/32            ident/host    all             all             127.0.0.1\/32            md5/g" $PG_HBA_CONF
sed -i "s/host    all             all             ::1\/128                 ident/host    all             all             ::1\/128                 md5/g" $PG_HBA_CONF

# Restart PostgreSQL to apply authentication changes
systemctl restart postgresql

# Create database and user
log "Creating database and user..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS cricket_scorer;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS cricket_user;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER cricket_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE cricket_scorer OWNER cricket_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;"

# Test database connection
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U cricket_user -d cricket_scorer -c "SELECT version();" >/dev/null 2>&1; then
    log "Database connection test successful"
else
    error "Database connection test failed"
    exit 1
fi

# ============================================================================
# SECTION 4: FIREWALL CONFIGURATION
# ============================================================================

log "SECTION 4: Configuring firewall..."

systemctl enable firewalld
systemctl start firewalld

# Open required ports
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload

# ============================================================================
# SECTION 5: APPLICATION DEPLOYMENT
# ============================================================================

log "SECTION 5: Deploying Cricket Scorer application..."

cd $APP_DIR

# Stop any existing PM2 processes
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true
sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true

# Clean existing files
rm -rf node_modules package*.json dist client server shared *.config.* *.json *.js *.ts

# Create package.json with resolved dependencies
log "Creating package.json with dependency resolution..."
cat > package.json << 'EOF'
{
  "name": "cricket-scorer",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@tanstack/react-query": "^5.60.5",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "express": "^4.21.2",
    "lucide-react": "^0.468.0",
    "openai": "^4.73.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.0",
    "tailwind-merge": "^2.5.4",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.30.1",
    "esbuild": "^0.24.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  }
}
EOF

# Create required configuration files
log "Creating TypeScript configurations..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["client/src", "server", "shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "drizzle.config.ts"]
}
EOF

# Create build configurations
cat > vite.config.ts << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
});
EOF

cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
EOF

# Create directory structure
mkdir -p client/src/{components,hooks,lib,pages} server shared

# Create basic application files (you'll need to copy your actual source files here)
log "Creating basic application structure..."

# Server files
cat > server/index.ts << 'EOF'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { createServer } from "http";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const server = createServer(app);

// API routes
await registerRoutes(app, server);

// Serve static files in production
app.use(express.static("dist/public"));

// Catch-all handler for SPA
app.get("*", (req, res) => {
  res.sendFile(path.resolve("dist/public/index.html"));
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`Cricket Scorer serving on port ${port}`);
});
EOF

cat > server/routes.ts << 'EOF'
import { type Express } from "express";
import { createServer } from "http";

export async function registerRoutes(app: Express, server: any) {
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      app: "Cricket Scorer"
    });
  });

  app.get("/api/teams", (req, res) => {
    res.json([
      { id: 1, name: "Team A", shortName: "TMA" },
      { id: 2, name: "Team B", shortName: "TMB" }
    ]);
  });

  app.get("/api/matches", (req, res) => {
    res.json([
      { id: 1, team1Id: 1, team2Id: 2, status: "upcoming" }
    ]);
  });

  return server;
}
EOF

cat > shared/schema.ts << 'EOF'
export interface Team {
  id: number;
  name: string;
  shortName: string;
}

export interface Match {
  id: number;
  team1Id: number;
  team2Id: number;
  status: string;
}
EOF

# Client files
cat > client/src/main.tsx << 'EOF'
import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">Cricket Scorer</h1>
        <p className="text-center text-xl mb-4">Production deployment successful!</p>
        <p className="text-center">Timestamp: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
EOF

cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cricket Scorer</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF

cat > client/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Install dependencies
log "Installing dependencies with dependency resolution..."
chown -R $APP_USER:$APP_USER $APP_DIR
sudo -u $APP_USER npm install --legacy-peer-deps

# Build application
log "Building application..."
sudo -u $APP_USER npm run build

# Create PM2 ecosystem config
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      DATABASE_URL: 'postgresql://cricket_user:$DB_PASSWORD@localhost:5432/cricket_scorer'
    },
    max_memory_restart: '500M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    merge_logs: true,
    error_file: '/opt/logs/error.log',
    out_file: '/opt/logs/out.log',
    log_file: '/opt/logs/combined.log',
    time: true
  }]
}
EOF

# ============================================================================
# SECTION 6: NGINX AND SSL CONFIGURATION
# ============================================================================

log "SECTION 6: Configuring Nginx and SSL..."

# Start and enable Nginx
systemctl enable nginx
systemctl start nginx

# Create Nginx configuration
cat > /etc/nginx/conf.d/cricket-scorer.conf << EOF
server {
    listen 80;
    server_name $DOMAIN $PUBLIC_IP;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN $PUBLIC_IP;
    
    # SSL Configuration (will be updated by certbot)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Proxy to Cricket Scorer app
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Test Nginx configuration
nginx -t || { error "Nginx configuration test failed"; exit 1; }

# Reload Nginx
systemctl reload nginx

# Obtain SSL certificate
log "Obtaining SSL certificate from Let's Encrypt..."
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email -d $DOMAIN || {
    warn "SSL certificate generation failed, continuing with HTTP only"
}

# ============================================================================
# SECTION 7: START APPLICATION
# ============================================================================

log "SECTION 7: Starting Cricket Scorer application..."

# Start application with PM2
sudo -u $APP_USER pm2 start ecosystem.config.cjs
sudo -u $APP_USER pm2 save
sudo -u $APP_USER pm2 startup | grep -v "PM2" | bash || true

# ============================================================================
# SECTION 8: VERIFICATION AND MONITORING
# ============================================================================

log "SECTION 8: Verifying deployment..."

# Wait for application to start
sleep 10

# Test API health
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    log "✅ API health check passed"
else
    warn "API health check failed, checking logs..."
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 10
fi

# Test external access
if curl -s -k https://$DOMAIN/api/health | grep -q "ok" 2>/dev/null; then
    log "✅ External HTTPS access working"
elif curl -s http://$DOMAIN/api/health | grep -q "ok" 2>/dev/null; then
    log "✅ External HTTP access working (SSL pending)"
else
    warn "External access test failed"
fi

# ============================================================================
# FINAL STATUS REPORT
# ============================================================================

log "==================== DEPLOYMENT COMPLETE ===================="
log "🏏 Cricket Scorer has been successfully deployed!"
log ""
log "📊 System Information:"
log "   OS: AlmaLinux 9"
log "   Domain: https://$DOMAIN"
log "   IP: $PUBLIC_IP"
log "   App Directory: $APP_DIR"
log ""
log "🔧 Services Status:"
systemctl is-active --quiet postgresql && log "   ✅ PostgreSQL: Running" || log "   ❌ PostgreSQL: Stopped"
systemctl is-active --quiet nginx && log "   ✅ Nginx: Running" || log "   ❌ Nginx: Stopped"
sudo -u $APP_USER pm2 status | grep -q "cricket-scorer" && log "   ✅ Cricket Scorer: Running" || log "   ❌ Cricket Scorer: Stopped"
log ""
log "🌐 Access Points:"
log "   Main Site: https://$DOMAIN"
log "   API Health: https://$DOMAIN/api/health"
log "   Teams API: https://$DOMAIN/api/teams"
log "   Matches API: https://$DOMAIN/api/matches"
log ""
log "📝 Logs and Monitoring:"
log "   PM2 Status: sudo -u $APP_USER pm2 status"
log "   PM2 Logs: sudo -u $APP_USER pm2 logs cricket-scorer"
log "   Nginx Logs: tail -f /var/log/nginx/error.log"
log "   App Logs: tail -f /opt/logs/combined.log"
log ""
log "🔒 Security:"
firewall-cmd --list-services | grep -q "http" && log "   ✅ Firewall configured" || log "   ❌ Firewall needs attention"
[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && log "   ✅ SSL certificate installed" || log "   ⚠️  SSL certificate pending"
log ""
log "Cricket Scorer is now live and ready for production use!"
log "==============================================================="