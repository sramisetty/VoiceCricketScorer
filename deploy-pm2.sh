#!/bin/bash

# Cricket Scorer Production Deployment Script with PM2 and SSL
# This script deploys the Cricket Scorer application with PM2 process management

set -e

# Configuration
APP_NAME="cricket-scorer"
APP_USER="cricketapp"
APP_DIR="/opt/cricket-scorer"
BACKUP_DIR="/opt/cricket-scorer-backups"
LOG_DIR="/var/log/cricket-scorer"
NGINX_SITE="/etc/nginx/sites-available/cricket-scorer"
DOMAIN=""  # Set this for SSL configuration

# Detect package manager and set variables
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
    PKG_UPDATE="apt-get update -y"
    PKG_UPGRADE="apt-get upgrade -y"
    PKG_INSTALL="apt-get install -y"
    NGINX_SERVICE="nginx"
    POSTGRES_SERVICE="postgresql"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    PKG_UPDATE="yum update -y"
    PKG_UPGRADE="yum upgrade -y"
    PKG_INSTALL="yum install -y"
    NGINX_SERVICE="nginx"
    POSTGRES_SERVICE="postgresql"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf update -y"
    PKG_UPGRADE="dnf upgrade -y"
    PKG_INSTALL="dnf install -y"
    NGINX_SERVICE="nginx"
    POSTGRES_SERVICE="postgresql"
else
    echo "Unsupported package manager. This script requires apt-get, yum, or dnf"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
fi

# Get domain for SSL (optional)
get_domain() {
    if [ -z "$DOMAIN" ]; then
        echo -n "Enter your domain name for SSL (optional, press Enter to skip): "
        read DOMAIN
    fi
}

# Install system dependencies
install_system_deps() {
    log "Installing system dependencies..."
    
    $PKG_UPDATE
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        $PKG_INSTALL curl wget git build-essential nginx postgresql postgresql-contrib ufw fail2ban htop unzip certbot python3-certbot-nginx
    elif [ "$PKG_MANAGER" = "yum" ]; then
        $PKG_INSTALL epel-release
        $PKG_INSTALL curl wget git gcc gcc-c++ make nginx postgresql postgresql-server postgresql-contrib firewalld fail2ban htop unzip certbot python3-certbot-nginx
    elif [ "$PKG_MANAGER" = "dnf" ]; then
        $PKG_INSTALL curl wget git gcc gcc-c++ make nginx postgresql postgresql-server postgresql-contrib firewalld fail2ban htop unzip certbot python3-certbot-nginx
    fi
    
    log "✓ System dependencies installed"
}

# Install Node.js 20
install_nodejs() {
    log "Installing Node.js 20..."
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        $PKG_INSTALL nodejs
    else
        # Remove existing Node.js to avoid conflicts
        $PKG_MANAGER remove -y nodejs npm 2>/dev/null || true
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        
        if [ "$PKG_MANAGER" = "yum" ]; then
            yum install -y --allowerasing nodejs
        else
            dnf install -y --allowerasing nodejs
        fi
    fi
    
    # Verify installation
    NODE_VERSION=$(node --version 2>/dev/null || echo "Failed")
    if [[ "$NODE_VERSION" == v20* ]]; then
        log "✓ Node.js 20 installed: $NODE_VERSION"
    else
        error "Failed to install Node.js 20"
    fi
}

# Install PM2 globally
install_pm2() {
    log "Installing PM2 process manager..."
    
    npm install -g pm2
    
    # Install PM2 log rotation
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true
    
    log "✓ PM2 installed with log rotation"
}

# Create application user
create_app_user() {
    log "Creating application user..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -m -s /bin/bash "$APP_USER"
        usermod -aG sudo "$APP_USER"
        log "✓ User $APP_USER created"
    else
        log "✓ User $APP_USER already exists"
    fi
}

# Setup PostgreSQL (or configure for external database)
setup_postgresql() {
    log "Setting up database configuration..."
    
    # Check if DATABASE_URL is already provided (e.g., Neon, external DB)
    if [ -f ".env" ] && grep -q "DATABASE_URL.*neon.tech" .env 2>/dev/null; then
        log "External database (Neon) detected - skipping local PostgreSQL installation"
        return 0
    fi
    
    # Install and setup local PostgreSQL only if needed
    if [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
        if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
            postgresql-setup initdb 2>/dev/null || postgresql-setup --initdb 2>/dev/null || true
        fi
    fi
    
    systemctl start $POSTGRES_SERVICE
    systemctl enable $POSTGRES_SERVICE
    
    # Create database and user
    DB_PASSWORD="cricket_secure_password_2025"
    sudo -u postgres psql -c "CREATE DATABASE cricket_scorer;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER cricket_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER cricket_user CREATEDB;" 2>/dev/null || true
    
    log "✓ PostgreSQL configured"
}

# Deploy application
deploy_app() {
    log "Deploying Cricket Scorer application..."
    
    mkdir -p "$APP_DIR" "$BACKUP_DIR" "$LOG_DIR"
    
    # Copy application files
    if [ ! -f "package.json" ]; then
        error "package.json not found. Run this script from the project directory."
    fi
    
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' . "$APP_DIR/current/"
    
    # Set ownership
    chown -R $APP_USER:$APP_USER "$APP_DIR" "$LOG_DIR"
    
    # Install dependencies and build
    cd "$APP_DIR/current"
    sudo -u $APP_USER npm install --production
    sudo -u $APP_USER npm run build
    
    log "✓ Application deployed"
}

# Create environment configuration
create_env() {
    log "Creating environment configuration..."
    
    SESSION_SECRET=$(openssl rand -base64 32)
    
    # Check if .env already exists and has DATABASE_URL (preserve existing database config)
    if [ -f "$APP_DIR/current/.env" ] && grep -q "DATABASE_URL" "$APP_DIR/current/.env"; then
        log "Existing .env file found - preserving database configuration"
        # Update only non-database settings
        sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" "$APP_DIR/current/.env"
        sed -i "s/^PORT=.*/PORT=3000/" "$APP_DIR/current/.env"
        
        # Add SESSION_SECRET if not present
        if ! grep -q "SESSION_SECRET" "$APP_DIR/current/.env"; then
            echo "SESSION_SECRET=$SESSION_SECRET" >> "$APP_DIR/current/.env"
        fi
        
        # Add OPENAI_API_KEY if not present
        if ! grep -q "OPENAI_API_KEY" "$APP_DIR/current/.env"; then
            echo "OPENAI_API_KEY=your_openai_api_key_here" >> "$APP_DIR/current/.env"
        fi
    else
        # Create new .env file with local database configuration
        cat > "$APP_DIR/current/.env" << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://cricket_user:cricket_secure_password_2025@localhost:5432/cricket_scorer
PGUSER=cricket_user
PGPASSWORD=cricket_secure_password_2025
PGDATABASE=cricket_scorer
PGHOST=localhost
PGPORT=5432

# Session Configuration
SESSION_SECRET=$SESSION_SECRET

# OpenAI Configuration (update with your API key)
OPENAI_API_KEY=your_openai_api_key_here

# Application Configuration
APP_URL=http://localhost:3000
LOG_LEVEL=info
EOF
    fi
    
    chown $APP_USER:$APP_USER "$APP_DIR/current/.env"
    chmod 600 "$APP_DIR/current/.env"
    
    log "✓ Environment configuration created"
}

# Create PM2 ecosystem configuration
create_pm2_config() {
    log "Creating PM2 ecosystem configuration..."
    
    cat > "$APP_DIR/current/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: './dist/index.js',
    cwd: '$APP_DIR/current',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '$LOG_DIR/error.log',
    out_file: '$LOG_DIR/out.log',
    log_file: '$LOG_DIR/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    
    chown $APP_USER:$APP_USER "$APP_DIR/current/ecosystem.config.cjs"
    
    log "✓ PM2 configuration created"
}

# Configure Nginx with SSL-ready setup
configure_nginx() {
    log "Configuring Nginx..."
    
    # Create nginx directories if they don't exist
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    
    cat > "$NGINX_SITE" << EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Static files with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site and remove default
    ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/ 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # For systems without sites-available/sites-enabled, use conf.d
    if [ ! -d "/etc/nginx/sites-available" ]; then
        mkdir -p /etc/nginx/conf.d
        cp "$NGINX_SITE" /etc/nginx/conf.d/cricket-scorer.conf
        # Remove default server block from main config
        sed -i '/server {/,/^}/d' /etc/nginx/nginx.conf 2>/dev/null || true
    fi
    
    # Test configuration
    nginx -t
    
    log "✓ Nginx configured"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
    else
        systemctl start firewalld
        systemctl enable firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
    
    log "✓ Firewall configured"
}

# Setup fail2ban
setup_fail2ban() {
    log "Setting up fail2ban..."
    
    cat > /etc/fail2ban/jail.d/cricket-scorer.conf << EOF
[cricket-scorer]
enabled = true
port = 80,443
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 600
findtime = 300
EOF
    
    systemctl start fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log "✓ Fail2ban configured"
}

# Create backup system
setup_backup() {
    log "Setting up backup system..."
    
    mkdir -p "$BACKUP_DIR"
    
    cat > /usr/local/bin/cricket-scorer-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/cricket-scorer-backups"
DATE=$(date +%Y%m%d-%H%M%S)
DB_BACKUP="$BACKUP_DIR/db-backup-$DATE.sql"
APP_BACKUP="$BACKUP_DIR/app-backup-$DATE.tar.gz"

# Create database backup
sudo -u postgres pg_dump cricket_scorer > "$DB_BACKUP"

# Create application backup
tar -czf "$APP_BACKUP" -C /opt/cricket-scorer current

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x /usr/local/bin/cricket-scorer-backup
    
    # Add daily backup cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/cricket-scorer-backup") | crontab -
    
    log "✓ Backup system configured"
}

# Start application with PM2
start_pm2_app() {
    log "Starting application with PM2..."
    
    cd "$APP_DIR/current"
    
    # Stop any existing PM2 processes
    sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true
    
    # Start application
    sudo -u $APP_USER pm2 start ecosystem.config.cjs
    
    # Save PM2 configuration
    sudo -u $APP_USER pm2 save
    
    # Setup PM2 startup script
    sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    
    log "✓ Application started with PM2"
}

# Start services
start_services() {
    log "Starting services..."
    
    systemctl enable nginx
    systemctl start nginx
    
    log "✓ Services started"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR/current"
    
    # Check if we're using Neon database (skip local PostgreSQL setup)
    if grep -q "neon.tech" "$APP_DIR/current/.env" 2>/dev/null; then
        log "Using Neon database - skipping local PostgreSQL setup"
        # Use existing DATABASE_URL from environment
        sudo -u $APP_USER npm run db:push
    else
        # For local PostgreSQL setup
        sudo -u $APP_USER npm run db:push
    fi
    
    log "✓ Database migrations completed"
}

# Setup SSL if domain provided
setup_ssl() {
    if [ -n "$DOMAIN" ]; then
        log "Setting up SSL for domain: $DOMAIN"
        
        # Get email for Let's Encrypt
        echo -n "Enter email for Let's Encrypt: "
        read EMAIL
        
        if [ -n "$EMAIL" ]; then
            # Obtain SSL certificate
            systemctl stop nginx
            certbot certonly --standalone --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN"
            
            # Create nginx directories if they don't exist
            mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
            
            # Update Nginx configuration for SSL
            cat > "$NGINX_SITE" << EOF
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Static files with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
            
            # Setup automatic renewal
            (crontab -l 2>/dev/null; echo "0 */12 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
            
            # Update app environment
            sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|" "$APP_DIR/current/.env"
            sudo -u $APP_USER pm2 restart cricket-scorer
            
            # For systems without sites-available/sites-enabled, use conf.d
            if [ ! -d "/etc/nginx/sites-available" ]; then
                mkdir -p /etc/nginx/conf.d
                cp "$NGINX_SITE" /etc/nginx/conf.d/cricket-scorer.conf
            fi
            
            systemctl start nginx
            
            log "✓ SSL configured for $DOMAIN"
        fi
    fi
}

# Show completion information
show_completion() {
    echo ""
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}                    CRICKET SCORER DEPLOYMENT COMPLETE${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
    echo ""
    
    if [ -n "$DOMAIN" ]; then
        echo -e "${GREEN}Application URL:${NC} https://$DOMAIN"
    else
        echo -e "${GREEN}Application URL:${NC} http://$(hostname -I | awk '{print $1}')"
    fi
    
    echo -e "${GREEN}Application Directory:${NC} $APP_DIR/current"
    echo -e "${GREEN}PM2 Logs Directory:${NC} $LOG_DIR"
    echo -e "${GREEN}Backup Directory:${NC} $BACKUP_DIR"
    echo ""
    echo -e "${YELLOW}PM2 Management Commands:${NC}"
    echo "  - View status: sudo -u $APP_USER pm2 status"
    echo "  - View logs: sudo -u $APP_USER pm2 logs cricket-scorer"
    echo "  - Restart app: sudo -u $APP_USER pm2 restart cricket-scorer"
    echo "  - Stop app: sudo -u $APP_USER pm2 stop cricket-scorer"
    echo "  - Monitor: sudo -u $APP_USER pm2 monit"
    echo ""
    echo -e "${YELLOW}System Management:${NC}"
    echo "  - Nginx logs: tail -f /var/log/nginx/access.log"
    echo "  - Restart Nginx: systemctl restart nginx"
    echo "  - Run backup: /usr/local/bin/cricket-scorer-backup"
    echo ""
    echo -e "${RED}Action Required:${NC}"
    echo "  - Update OPENAI_API_KEY in $APP_DIR/current/.env"
    echo ""
    echo -e "${GREEN}PM2 Application Status:${NC}"
    sudo -u $APP_USER pm2 status 2>/dev/null || echo "PM2 status unavailable"
    echo ""
}

# Main function
main() {
    log "Starting Cricket Scorer production deployment with PM2..."
    
    get_domain
    install_system_deps
    install_nodejs
    install_pm2
    create_app_user
    setup_postgresql
    deploy_app
    create_env
    create_pm2_config
    configure_nginx
    setup_firewall
    setup_fail2ban
    setup_backup
    run_migrations
    start_pm2_app
    start_services
    setup_ssl
    show_completion
    
    log "Cricket Scorer deployment with PM2 completed successfully!"
}

# Run main function
main "$@"