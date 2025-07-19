#!/bin/bash

# Voice-Enabled Cricket Scoring App - Production Deployment Script
# This script sets up the complete production environment on a Linux server

set -e  # Exit on any error

# Configuration
APP_NAME="cricket-scorer"
APP_USER="cricketapp"
APP_DIR="/opt/cricket-scorer"
NGINX_SITE="/etc/nginx/sites-available/cricket-scorer"
SERVICE_FILE="/etc/systemd/system/cricket-scorer.service"
LOG_DIR="/var/log/cricket-scorer"
BACKUP_DIR="/opt/cricket-scorer-backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Detect package manager and set variables
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_UPDATE="apt-get update -y"
        PKG_UPGRADE="apt-get upgrade -y"
        PKG_INSTALL="apt-get install -y"
        NGINX_SERVICE="nginx"
        POSTGRES_SERVICE="postgresql"
        log "Detected Debian/Ubuntu system (apt)"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_UPDATE="yum update -y"
        PKG_UPGRADE="yum upgrade -y"
        PKG_INSTALL="yum install -y"
        NGINX_SERVICE="nginx"
        POSTGRES_SERVICE="postgresql"
        log "Detected CentOS/RHEL system (yum)"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_UPDATE="dnf update -y"
        PKG_UPGRADE="dnf upgrade -y"
        PKG_INSTALL="dnf install -y"
        NGINX_SERVICE="nginx"
        POSTGRES_SERVICE="postgresql"
        log "Detected Fedora system (dnf)"
    else
        error "Unsupported package manager. This script requires apt-get, yum, or dnf"
    fi
}

# System requirements check
check_system() {
    log "Checking system requirements..."
    
    detect_package_manager
    
    # Check available disk space (minimum 2GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then
        warn "Less than 2GB disk space available. Deployment may fail."
    fi
    
    # Check RAM (minimum 1GB)
    TOTAL_RAM=$(free -m | awk 'NR==2{print $2}')
    if [ "$TOTAL_RAM" -lt 1024 ]; then
        warn "Less than 1GB RAM available. Performance may be affected."
    fi
    
    log "System requirements check completed"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    $PKG_UPDATE
    $PKG_UPGRADE
    log "System packages updated"
}

# Install required packages
install_dependencies() {
    log "Installing system dependencies..."
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        # Ubuntu/Debian packages
        $PKG_INSTALL \
            curl \
            wget \
            git \
            build-essential \
            nginx \
            postgresql \
            postgresql-contrib \
            ufw \
            fail2ban \
            htop \
            unzip \
            supervisor \
            certbot \
            python3-certbot-nginx
    elif [ "$PKG_MANAGER" = "yum" ]; then
        # CentOS/RHEL packages
        # Enable EPEL repository for additional packages
        $PKG_INSTALL epel-release
        $PKG_INSTALL \
            curl \
            wget \
            git \
            gcc \
            gcc-c++ \
            make \
            nginx \
            postgresql \
            postgresql-server \
            postgresql-contrib \
            firewalld \
            fail2ban \
            htop \
            unzip \
            supervisor \
            certbot \
            python3-certbot-nginx
    elif [ "$PKG_MANAGER" = "dnf" ]; then
        # Fedora packages
        $PKG_INSTALL \
            curl \
            wget \
            git \
            gcc \
            gcc-c++ \
            make \
            nginx \
            postgresql \
            postgresql-server \
            postgresql-contrib \
            firewalld \
            fail2ban \
            htop \
            unzip \
            supervisor \
            certbot \
            python3-certbot-nginx
    fi
    
    log "System dependencies installed"
}

# Install Node.js
install_nodejs() {
    log "Installing Node.js 20..."
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        # Ubuntu/Debian Node.js installation
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        $PKG_INSTALL nodejs
    elif [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
        # CentOS/RHEL/Fedora Node.js installation
        
        # Remove existing Node.js and npm to avoid conflicts
        log "Removing existing Node.js packages to avoid conflicts..."
        $PKG_MANAGER remove -y nodejs npm 2>/dev/null || true
        
        # Clean package cache
        if [ "$PKG_MANAGER" = "yum" ]; then
            yum clean all
        elif [ "$PKG_MANAGER" = "dnf" ]; then
            dnf clean all
        fi
        
        # Install Node.js 20 from NodeSource with conflict resolution
        log "Setting up NodeSource repository..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        
        # Install with allowerasing to handle conflicts
        log "Installing Node.js 20 with conflict resolution..."
        if [ "$PKG_MANAGER" = "yum" ]; then
            yum install -y --allowerasing nodejs
        elif [ "$PKG_MANAGER" = "dnf" ]; then
            dnf install -y --allowerasing nodejs
        fi
    fi
    
    # Verify installation
    NODE_VERSION=$(node --version 2>/dev/null || echo "Failed to get version")
    NPM_VERSION=$(npm --version 2>/dev/null || echo "Failed to get version")
    
    if [[ "$NODE_VERSION" == v20* ]]; then
        log "✓ Node.js installed successfully: $NODE_VERSION"
        log "✓ NPM installed: $NPM_VERSION"
    else
        error "Failed to install Node.js 20. Current version: $NODE_VERSION"
    fi
}

# Create application user
create_app_user() {
    log "Creating application user..."
    
    if id "$APP_USER" &>/dev/null; then
        log "User $APP_USER already exists"
    else
        useradd -r -m -s /bin/bash "$APP_USER"
        log "User $APP_USER created"
    fi
    
    # Create application directories
    mkdir -p "$APP_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
    chown -R "$APP_USER:$APP_USER" "$BACKUP_DIR"
    
    log "Application directories created"
}

# Setup PostgreSQL database
setup_database() {
    log "Setting up PostgreSQL database..."
    
    if [ "$PKG_MANAGER" = "yum" ] || [ "$PKG_MANAGER" = "dnf" ]; then
        # Initialize PostgreSQL on CentOS/RHEL/Fedora
        if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
            postgresql-setup initdb 2>/dev/null || postgresql-setup --initdb 2>/dev/null || true
        fi
    fi
    
    # Start and enable PostgreSQL
    systemctl start $POSTGRES_SERVICE
    systemctl enable $POSTGRES_SERVICE
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE cricket_scorer;" 2>/dev/null || log "Database already exists"
    sudo -u postgres psql -c "CREATE USER cricket_user WITH PASSWORD 'cricket_secure_password_2025';" 2>/dev/null || log "User already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER USER cricket_user CREATEDB;" 2>/dev/null || true
    
    # Configure PostgreSQL for network connections
    PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"
    else
        PG_CONFIG_DIR="/var/lib/pgsql/data"
    fi
    
    # Update postgresql.conf
    if [ -f "$PG_CONFIG_DIR/postgresql.conf" ]; then
        sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONFIG_DIR/postgresql.conf"
        
        # Update pg_hba.conf
        echo "local   cricket_scorer   cricket_user                md5" >> "$PG_CONFIG_DIR/pg_hba.conf"
    fi
    
    # Restart PostgreSQL
    systemctl restart $POSTGRES_SERVICE
    
    log "PostgreSQL database setup completed"
}

# Deploy application
deploy_application() {
    log "Deploying Cricket Scorer application..."
    
    # Navigate to application directory
    cd "$APP_DIR"
    
    # If this is an update, backup current version
    if [ -d "current" ]; then
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        mv current "$BACKUP_DIR/$BACKUP_NAME"
        log "Previous version backed up to $BACKUP_DIR/$BACKUP_NAME"
    fi
    
    # Create new deployment directory
    mkdir -p current
    cd current
    
    # Copy application files (assuming they're in the same directory as this script)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Copy all necessary files
    cp -r "$SCRIPT_DIR"/* . 2>/dev/null || true
    
    # Remove deployment script from app directory
    rm -f deploy.sh
    
    # Install Node.js dependencies
    sudo -u "$APP_USER" npm install --production
    
    # Build the application
    sudo -u "$APP_USER" npm run build
    
    # Set proper ownership
    chown -R "$APP_USER:$APP_USER" "$APP_DIR/current"
    
    log "Application deployed"
}

# Create environment configuration
create_env_config() {
    log "Creating environment configuration..."
    
    # Generate secure random strings
    DB_PASSWORD="cricket_secure_password_2025"
    SESSION_SECRET=$(openssl rand -base64 32)
    
    # Create .env file
    cat > "$APP_DIR/current/.env" << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://cricket_user:$DB_PASSWORD@localhost:5432/cricket_scorer
PGUSER=cricket_user
PGPASSWORD=$DB_PASSWORD
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
    
    chown "$APP_USER:$APP_USER" "$APP_DIR/current/.env"
    chmod 600 "$APP_DIR/current/.env"
    
    log "Environment configuration created"
    warn "Remember to update OPENAI_API_KEY in $APP_DIR/current/.env"
}

# Create systemd service
create_systemd_service() {
    log "Creating systemd service..."
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Cricket Scorer Application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/current
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/current/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cricket-scorer

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR $LOG_DIR

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable cricket-scorer
    
    log "Systemd service created and enabled"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."
    
    cat > "$NGINX_SITE" << EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
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
    }
    
    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
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
    
    # Enable the site
    ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    systemctl reload nginx
    
    log "Nginx configured and started"
}

# Setup firewall
configure_firewall() {
    log "Configuring firewall..."
    
    if [ "$PKG_MANAGER" = "apt" ]; then
        # Ubuntu/Debian - use UFW
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
    else
        # CentOS/RHEL/Fedora - use firewalld
        systemctl start firewalld
        systemctl enable firewalld
        
        # Configure firewall rules
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
    
    log "Firewall configured"
}

# Setup fail2ban
configure_fail2ban() {
    log "Configuring fail2ban..."
    
    # Create custom jail for the application
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
    
    # Start and enable fail2ban
    systemctl start fail2ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log "Fail2ban configured"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR/current"
    
    # Run Drizzle migrations
    sudo -u "$APP_USER" npm run db:push
    
    log "Database migrations completed"
}

# Create backup script
create_backup_script() {
    log "Creating backup script..."
    
    cat > /usr/local/bin/cricket-scorer-backup << 'EOF'
#!/bin/bash

# Cricket Scorer Backup Script
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
    
    # Create daily backup cron job
    echo "0 2 * * * /usr/local/bin/cricket-scorer-backup" | crontab -
    
    log "Backup script created with daily cron job"
}

# Start application
start_application() {
    log "Starting Cricket Scorer application..."
    
    # Start the service
    systemctl start cricket-scorer
    
    # Wait a moment for startup
    sleep 5
    
    # Check status
    if systemctl is-active --quiet cricket-scorer; then
        log "Application started successfully"
    else
        error "Failed to start application. Check logs: journalctl -u cricket-scorer"
    fi
}

# Display deployment summary
show_summary() {
    echo ""
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}                    CRICKET SCORER DEPLOYMENT COMPLETED${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
    echo ""
    echo -e "${GREEN}Application URL:${NC} http://$(hostname -I | awk '{print $1}')"
    echo -e "${GREEN}Application Directory:${NC} $APP_DIR/current"
    echo -e "${GREEN}Log Directory:${NC} $LOG_DIR"
    echo -e "${GREEN}Backup Directory:${NC} $BACKUP_DIR"
    echo ""
    echo -e "${YELLOW}Important Configuration Files:${NC}"
    echo "  - Environment: $APP_DIR/current/.env"
    echo "  - Nginx Config: $NGINX_SITE"
    echo "  - Systemd Service: $SERVICE_FILE"
    echo ""
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo "  - View logs: journalctl -u cricket-scorer -f"
    echo "  - Restart app: systemctl restart cricket-scorer"
    echo "  - Restart nginx: systemctl restart nginx"
    echo "  - Run backup: /usr/local/bin/cricket-scorer-backup"
    echo ""
    echo -e "${RED}Action Required:${NC}"
    echo "  - Update OPENAI_API_KEY in $APP_DIR/current/.env"
    echo "  - Configure your domain name in Nginx if needed"
    echo "  - Setup SSL certificate with: certbot --nginx"
    echo ""
    echo -e "${GREEN}Service Status:${NC}"
    systemctl --no-pager status cricket-scorer nginx postgresql
    echo ""
}

# Main deployment function
main() {
    log "Starting Cricket Scorer deployment..."
    
    check_root
    check_system
    update_system
    install_dependencies
    install_nodejs
    create_app_user
    setup_database
    deploy_application
    create_env_config
    run_migrations
    create_systemd_service
    configure_nginx
    configure_firewall
    configure_fail2ban
    create_backup_script
    start_application
    show_summary
    
    log "Deployment completed successfully!"
}

# Run main function
main "$@"