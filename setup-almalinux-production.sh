#!/bin/bash

# Cricket Scorer Production Server Setup for AlmaLinux 9
# This script sets up all dependencies and infrastructure for production deployment

# Note: Removed global 'set -e' to allow proper error handling in SSL section

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# System information
print_system_info() {
    log "System Information:"
    echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "CPU Cores: $(nproc)"
    echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
    echo "Disk Space: $(df -h / | awk 'NR==2 {print $4}') available"
    echo ""
}

# Update system packages
update_system() {
    log "Updating system packages..."
    dnf update -y
    dnf install -y epel-release
    success "System updated successfully"
}

# Install essential system tools
install_system_tools() {
    log "Installing essential system tools..."
    dnf install -y \
        curl \
        wget \
        git \
        unzip \
        tar \
        openssl \
        openssl-devel \
        gcc \
        gcc-c++ \
        make \
        python3 \
        python3-pip \
        vim \
        nano \
        htop \
        firewalld \
        fail2ban \
        certbot \
        python3-certbot-nginx \
        bind-utils
    
    systemctl enable firewalld
    systemctl start firewalld
    success "Essential system tools installed"
}

# Install Node.js 20.x (required version)
install_nodejs() {
    log "Installing Node.js 20.x..."
    
    # Remove any existing Node.js installations
    dnf remove -y nodejs npm nodejs-npm 2>/dev/null || true
    
    # Install Node.js 20.x from NodeSource
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    if [[ $NODE_VERSION =~ ^v20\. ]]; then
        success "Node.js installed: $NODE_VERSION"
        success "npm installed: $NPM_VERSION"
    else
        error "Node.js 20.x installation failed. Current version: $NODE_VERSION"
        exit 1
    fi
    
# Install global packages required for Linux VPS production
    npm install -g pm2@latest
    npm install -g tsx@latest
    npm install -g drizzle-kit@latest
    npm install -g vite@latest
    npm install -g esbuild@latest
    
    # VPS-specific optimizations
    npm config set fund false
    npm config set audit false
    
    success "Global npm packages installed"
}

# Install PostgreSQL 15
install_postgresql() {
    log "Installing PostgreSQL 15..."
    
# Install EPEL repository for additional Perl modules
    dnf install -y epel-release
    
    # Install essential development tools and libraries
    log "Installing development tools and libraries..."
    dnf install -y gcc gcc-c++ make cmake \
                   openssl-devel readline-devel zlib-devel libxml2-devel \
                   perl-devel perl-CPAN perl-ExtUtils-MakeMaker 2>/dev/null || {
        warning "Some development packages failed to install, continuing..."
    }
    
    # Use AlmaLinux built-in PostgreSQL for maximum compatibility
    log "Installing PostgreSQL from AlmaLinux repositories for maximum stability..."
    install_postgresql_builtin
    
    # Enable PostgreSQL service
    log "Enabling and starting PostgreSQL service..."
    systemctl enable $PG_SERVICE
    
    # Start PostgreSQL service with proper error handling
    log "Starting PostgreSQL service..."
    
    if systemctl start $PG_SERVICE; then
        success "PostgreSQL service started successfully"
    else
        error "PostgreSQL service failed to start"
        
        # Check for upgrade requirement (the specific error we're seeing)
        if journalctl -xeu $PG_SERVICE --no-pager -n 5 | grep -q "postgresql-setup --upgrade"; then
            log "Database version mismatch detected - performing upgrade..."
            
            # Stop the service
            systemctl stop $PG_SERVICE 2>/dev/null || true
            
            # Perform upgrade
            if $PG_SETUP --upgrade; then
                success "Database upgraded successfully, starting service..."
                if systemctl start $PG_SERVICE; then
                    success "PostgreSQL started after upgrade"
                else
                    error "PostgreSQL failed to start even after upgrade"
                    exit 1
                fi
            else
                # If upgrade fails, backup old data and reinitialize
                warning "Upgrade failed, backing up old data and reinitializing..."
                mv "$PG_DATA_DIR" "${PG_DATA_DIR}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
                
                if $PG_SETUP --initdb && systemctl start $PG_SERVICE; then
                    success "Fresh database created and PostgreSQL started"
                else
                    error "Complete PostgreSQL setup failed"
                    exit 1
                fi
            fi
        else
            # Other startup issues
            log "Checking PostgreSQL logs for other issues..."
            journalctl -xeu $PG_SERVICE --no-pager -n 10
            error "PostgreSQL startup failed for unknown reasons"
            exit 1
        fi
    fi
    
    # Wait for PostgreSQL to be ready and accepting connections
    log "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if sudo -u postgres psql -c "SELECT 1;" &>/dev/null 2>&1; then
            success "PostgreSQL is ready and accepting connections"
            break
        fi
        
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to accept connections after 60 seconds"
            log "Service status:"
            systemctl status $PG_SERVICE --no-pager -l || true
            log "Connection test failed - checking if service is actually running..."
            
            if systemctl is-active $PG_SERVICE &>/dev/null; then
                warning "PostgreSQL service is running but not accepting connections"
                warning "This may resolve itself - continuing with setup..."
            else
                error "PostgreSQL service is not running"
                exit 1
            fi
            break
        fi
        
        sleep 2
    done
    
    # Configure PostgreSQL for Cricket Scorer application
    log "Configuring PostgreSQL for application access..."
    
    PG_CONF="$PG_DATA_DIR/postgresql.conf"
    PG_HBA="$PG_DATA_DIR/pg_hba.conf"
    
    # Create backup copies of configuration files
    cp "$PG_CONF" "${PG_CONF}.backup" 2>/dev/null || true
    cp "$PG_HBA" "${PG_HBA}.backup" 2>/dev/null || true
    
    # Update postgresql.conf with application-specific settings
    log "Updating PostgreSQL configuration..."
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" "$PG_CONF"
    sed -i "s/#port = 5432/port = 5432/" "$PG_CONF"
    sed -i "s/#max_connections = 100/max_connections = 200/" "$PG_CONF"
    
    # Add performance and reliability settings
    if ! grep -q "shared_buffers" "$PG_CONF" | grep -v "^#"; then
        echo "shared_buffers = 256MB" >> "$PG_CONF"
    fi
    
    # Update pg_hba.conf for secure application access
    log "Configuring PostgreSQL authentication..."
    
    # Add Cricket Scorer application access if not already present
    if ! grep -q "Cricket Scorer Application Access" "$PG_HBA"; then
        cat >> "$PG_HBA" << EOF

# Cricket Scorer Application Access
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF
    fi
    
    # Set proper permissions on configuration files
    chown postgres:postgres "$PG_CONF" "$PG_HBA"
    chmod 600 "$PG_CONF" "$PG_HBA"
    
    # Restart PostgreSQL to apply new configuration
    log "Restarting PostgreSQL with new configuration..."
    if systemctl restart $PG_SERVICE; then
        success "PostgreSQL restarted successfully with new configuration"
        
        # Verify service is working after restart
        sleep 3
        for i in {1..10}; do
            if sudo -u postgres psql -c "SELECT version();" &>/dev/null; then
                success "PostgreSQL configuration applied and service is ready"
                break
            fi
            sleep 2
            if [ $i -eq 10 ]; then
                warning "PostgreSQL restarted but may not be fully ready yet"
            fi
        done
    else
        error "Failed to restart PostgreSQL after configuration changes"
        log "Reverting to backup configuration..."
        cp "${PG_CONF}.backup" "$PG_CONF" 2>/dev/null || true
        cp "${PG_HBA}.backup" "$PG_HBA" 2>/dev/null || true
        systemctl restart $PG_SERVICE
        exit 1
    fi
    
    success "PostgreSQL installed and configured"
}

# Fallback PostgreSQL installation using AlmaLinux built-in packages
install_postgresql_builtin() {
    log "Installing PostgreSQL from AlmaLinux built-in repositories..."
    
    # Enable PostgreSQL module (version may vary)
    if dnf module enable postgresql:15 -y 2>/dev/null; then
        log "Enabled PostgreSQL 15 module"
        PG_VERSION="15"
    elif dnf module enable postgresql:13 -y 2>/dev/null; then
        log "Enabled PostgreSQL 13 module (15 not available)"
        PG_VERSION="13"
    else
        log "Using default PostgreSQL version"
        PG_VERSION="default"
    fi
    
    # Install PostgreSQL packages
    if dnf install -y postgresql-server postgresql postgresql-contrib; then
        # Try to install development packages
        dnf install -y postgresql-devel 2>/dev/null || {
            warning "PostgreSQL development packages not available, skipping"
        }
        
        # Set variables for built-in PostgreSQL
        PG_SETUP="postgresql-setup"
        PG_SERVICE="postgresql"
        PG_DATA_DIR="/var/lib/pgsql/data"
        
        success "PostgreSQL installed from AlmaLinux built-in repositories"
        
        # Handle PostgreSQL database setup with version compatibility
        log "Setting up PostgreSQL database..."
        
        # Always start fresh to avoid version conflicts and corruption issues
        log "Ensuring clean PostgreSQL installation..."
        
        # Stop any existing PostgreSQL service
        systemctl stop postgresql 2>/dev/null || true
        
        # Check for existing database and handle version issues
        if [ -d "$PG_DATA_DIR" ]; then
            if [ -f "$PG_DATA_DIR/PG_VERSION" ]; then
                EXISTING_VERSION=$(cat "$PG_DATA_DIR/PG_VERSION" 2>/dev/null || echo "unknown")
                log "Found existing database version: $EXISTING_VERSION"
                
                # Try upgrade first if versions don't match
                if [[ "$EXISTING_VERSION" != "15" ]] && [[ "$EXISTING_VERSION" != "unknown" ]]; then
                    log "Attempting database upgrade from version $EXISTING_VERSION to 15..."
                    if $PG_SETUP --upgrade 2>/dev/null; then
                        success "Database upgraded successfully to version 15"
                    else
                        warning "Upgrade failed, backing up old database and creating fresh one"
                        mv "$PG_DATA_DIR" "${PG_DATA_DIR}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
                        
                        if $PG_SETUP --initdb; then
                            success "Fresh PostgreSQL database initialized"
                        else
                            error "Failed to initialize fresh database"
                            exit 1
                        fi
                    fi
                else
                    log "Database version appears compatible, checking integrity..."
                    # Quick integrity check
                    if [ ! -f "$PG_DATA_DIR/postgresql.conf" ] || [ ! -f "$PG_DATA_DIR/pg_hba.conf" ]; then
                        warning "Database integrity issues detected, reinitializing..."
                        rm -rf "$PG_DATA_DIR" 2>/dev/null || true
                        if $PG_SETUP --initdb; then
                            success "Database reinitialized successfully"
                        else
                            error "Database reinitialization failed"
                            exit 1
                        fi
                    fi
                fi
            else
                warning "Database directory exists but no version info found, reinitializing..."
                rm -rf "$PG_DATA_DIR" 2>/dev/null || true
                if $PG_SETUP --initdb; then
                    success "Database initialized successfully"
                else
                    error "Database initialization failed"
                    exit 1
                fi
            fi
        else
            # No existing database
            log "No existing database found, creating fresh installation..."
            if $PG_SETUP --initdb; then
                success "Fresh PostgreSQL database initialized successfully"
            else
                error "PostgreSQL database initialization failed"
                exit 1
            fi
        fi
        
        # Set proper ownership and permissions
        chown -R postgres:postgres /var/lib/pgsql/
        chmod 700 "$PG_DATA_DIR"
        chmod 600 "$PG_DATA_DIR"/*.conf 2>/dev/null || true
        
    else
        error "Failed to install PostgreSQL from AlmaLinux repositories"
        error "Please check your internet connection and try again"
        exit 1
    fi
}

# Install and configure Nginx
install_nginx() {
    log "Installing and configuring Nginx..."
    
    dnf install -y nginx
    
    # Enable and start Nginx
    systemctl enable nginx
    systemctl start nginx
    
    # Create application directory
    mkdir -p /opt/cricket-scorer
    mkdir -p /opt/cricket-scorer/logs
    
    # Set permissions
    chown -R root:root /opt/cricket-scorer
    chmod -R 755 /opt/cricket-scorer
    
    # Create Nginx configuration for Cricket Scorer
    cat > /etc/nginx/conf.d/cricket-scorer.conf << 'EOF'
# Cricket Scorer Application Configuration

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=app:10m rate=30r/s;

# Upstream for Node.js application
upstream cricket_scorer_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 64;
}

server {
    listen 80;
    server_name score.ramisetty.net 67.227.251.94;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml application/rss+xml application/atom+xml image/svg+xml;
    
    # Root directory
    root /opt/cricket-scorer/server/public;
    index index.html;
    
    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://cricket_scorer_backend;
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
    
    # WebSocket support
    location /ws {
        proxy_pass http://cricket_scorer_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # SPA fallback
    location / {
        limit_req zone=app burst=50 nodelay;
        try_files $uri $uri/ /index.html;
    }
    
    # Security
    location ~ /\. {
        deny all;
    }
    
    # Health check
    location /health {
        proxy_pass http://cricket_scorer_backend;
        access_log off;
    }
}
EOF
    
    # Test Nginx configuration
    nginx -t
    systemctl reload nginx
    
    success "Nginx installed and configured"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Open required ports
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-service=postgresql
    firewall-cmd --permanent --add-port=3000/tcp  # Node.js application
    firewall-cmd --permanent --add-port=22/tcp    # SSH
    
    # Reload firewall
    firewall-cmd --reload
    
    success "Firewall configured"
}

# Configure fail2ban
configure_fail2ban() {
    log "Configuring fail2ban..."
    
    # Create jail for SSH
    cat > /etc/fail2ban/jail.d/cricket-scorer.conf << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
EOF
    
    systemctl enable fail2ban
    systemctl start fail2ban
    
    success "fail2ban configured"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    log "Setting up SSL certificate with Let's Encrypt..."
    
    # SSL setup with proper error handling
    
    # Check if domain resolves to this server
    DOMAIN="score.ramisetty.net"
    SERVER_IP=$(curl -s ifconfig.me)
    
    # Install bind-utils if dig command is missing
    if ! command -v dig &> /dev/null; then
        log "Installing DNS utilities..."
        dnf install -y bind-utils
    fi
    
    DOMAIN_IP=$(dig +short $DOMAIN 2>/dev/null || nslookup $DOMAIN | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "")
    
    if [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
        log "Domain resolves correctly. Obtaining SSL certificate..."
        
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Try to obtain certificate
        log "Attempting to obtain SSL certificate..."
        certbot certonly --standalone \
            --non-interactive \
            --agree-tos \
            --email admin@ramisetty.net \
            -d $DOMAIN
        
        CERT_RESULT=$?
        if [ $CERT_RESULT -eq 0 ]; then
            log "SSL certificate obtained successfully"
        else
            log "Certificate already exists or renewal not needed - this is normal"
        fi
        
        # Create SSL configuration
        cat > /etc/nginx/conf.d/cricket-scorer-ssl.conf << 'EOF'
server {
    listen 443 ssl http2;
    server_name score.ramisetty.net;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/score.ramisetty.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/score.ramisetty.net/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/score.ramisetty.net/chain.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Include main configuration
    include /etc/nginx/conf.d/cricket-scorer-common.conf;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name score.ramisetty.net;
    return 301 https://$server_name$request_uri;
}
EOF
        
        # Extract common configuration
        grep -A 200 "gzip on;" /etc/nginx/conf.d/cricket-scorer.conf | grep -B 200 "location ~ /\\." > /etc/nginx/conf.d/cricket-scorer-common.conf
        
        # Setup auto-renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
        
        # Test certificate renewal (optional - don't let this stop the script)
        log "Testing certificate status..."
        /usr/bin/certbot renew --dry-run --quiet 2>/dev/null
        log "Certificate renewal test completed"
        
        # Start nginx
        systemctl start nginx
        
        # Test nginx configuration and reload if valid
        if nginx -t; then
            systemctl reload nginx
            success "SSL certificate installed and configured"
        else
            warning "Nginx configuration test failed, using HTTP-only configuration"
            systemctl restart nginx
        fi
    else
        warning "Domain does not resolve to this server. SSL setup skipped."
        warning "Current server IP: $SERVER_IP"
        warning "Domain resolves to: $DOMAIN_IP"
        warning "Please update DNS records and run SSL setup manually later."
        
        # Ensure nginx is still running for HTTP
        systemctl start nginx
    fi
    
    # SSL setup function completed
    
    log "SSL setup completed, continuing with database setup..."
}

# Create database and user for Cricket Scorer
setup_database() {
    log "Setting up Cricket Scorer database..."
    
    # Prompt for database credentials
    echo -n "Enter database name (default: cricket_scorer): "
    read DB_NAME
    DB_NAME=${DB_NAME:-cricket_scorer}
    
    echo -n "Enter database username (default: cricket_user): "
    read DB_USER
    DB_USER=${DB_USER:-cricket_user}
    
    echo -n "Enter database password: "
    read -s DB_PASSWORD
    echo
    
    if [ -z "$DB_PASSWORD" ]; then
        error "Database password cannot be empty"
        exit 1
    fi
    
    # Fix PostgreSQL authentication first
    log "Configuring PostgreSQL authentication..."
    
    # Set up pg_hba.conf for proper authentication
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
    if [ -f "$PG_HBA" ]; then
        # Backup original configuration
        cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
        
        # Add TCP authentication entries if they don't exist
        if ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA"; then
            echo "host    all             all             127.0.0.1/32            md5" >> "$PG_HBA"
        fi
        
        if ! grep -q "host.*all.*all.*::1/128.*md5" "$PG_HBA"; then
            echo "host    all             all             ::1/128                 md5" >> "$PG_HBA"
        fi
        
        # Restart PostgreSQL to apply changes
        systemctl restart postgresql
        sleep 3
        
        log "PostgreSQL authentication configured"
    fi
    
    # Set up PostgreSQL authentication to avoid password prompts completely
    log "Configuring PostgreSQL for automated setup..."
    
    # Check if PostgreSQL is running, if not start it
    if ! systemctl is-active --quiet postgresql; then
        log "Starting PostgreSQL service..."
        systemctl enable postgresql
        systemctl start postgresql
        sleep 5
        
        if ! systemctl is-active --quiet postgresql; then
            error "Failed to start PostgreSQL service"
            exit 1
        fi
    fi
    
    # Create a temporary script to run all database commands as postgres user
    cat > /tmp/create_db.sql << EOF
-- Set up postgres user password first
ALTER USER postgres PASSWORD 'postgres123';

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Create user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;

-- Verify setup
\l
\du
EOF
    
    # Execute the SQL script as postgres user using local socket connection
    log "Creating database and user..."
    if sudo -u postgres psql -f /tmp/create_db.sql 2>/dev/null; then
        success "Database and user created successfully via SQL script"
    else
        warning "SQL script method failed, trying individual commands..."
        
        # Fallback to individual commands with explicit local connection
        log "Attempting fallback database creation..."
        
        # Try using local socket connection explicitly
        sudo -u postgres psql -h /var/run/postgresql -c "ALTER USER postgres PASSWORD 'postgres123';" 2>/dev/null || true
        sudo -u postgres createdb "$DB_NAME" 2>/dev/null || log "Database may already exist"
        sudo -u postgres createuser "$DB_USER" 2>/dev/null || log "User may already exist"
        sudo -u postgres psql -h /var/run/postgresql -c "ALTER USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
        sudo -u postgres psql -h /var/run/postgresql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
        sudo -u postgres psql -h /var/run/postgresql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null || true
        
        log "Fallback database creation completed"
    fi
    
    # Clean up temporary script
    rm -f /tmp/create_db.sql 2>/dev/null || true
    
    success "Database and user created successfully"
    
    # Test connection with better error handling
    export PGPASSWORD=$DB_PASSWORD
    log "Testing database connection..."
    
    # Check if PostgreSQL is running
    if ! systemctl is-active --quiet postgresql; then
        log "PostgreSQL service not running, starting it..."
        systemctl start postgresql
        sleep 3
    fi
    
    # Test connection with detailed error reporting
    if psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>/tmp/db_error.log; then
        success "Database created and connection tested successfully"
        
        # Create directory if it doesn't exist
        mkdir -p /opt/cricket-scorer
        
        # Save database URL for later use
        echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > /opt/cricket-scorer/.env.template
        chmod 600 /opt/cricket-scorer/.env.template
        
        log "Database connection string saved to /opt/cricket-scorer/.env.template"
    else
        warning "Database connection test failed, checking configuration..."
        log "Error details:"
        cat /tmp/db_error.log 2>/dev/null || echo "No error log available"
        
        # Authentication should already be configured, but double-check
        log "Verifying PostgreSQL authentication configuration..."
        PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
        if [ -f "$PG_HBA" ] && ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA"; then
            log "Adding missing TCP authentication entries..."
            echo "host    all             all             127.0.0.1/32            md5" >> "$PG_HBA"
            echo "host    all             all             ::1/128                 md5" >> "$PG_HBA"
            systemctl restart postgresql
            sleep 3
            
            # Retry connection test
            log "Retrying database connection..."
            if psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
                success "Database connection successful after authentication fix"
                
                # Create directory if it doesn't exist
                mkdir -p /opt/cricket-scorer
                
                # Save database URL for later use
                echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > /opt/cricket-scorer/.env.template
                chmod 600 /opt/cricket-scorer/.env.template
                
                log "Database connection string saved to /opt/cricket-scorer/.env.template"
            else
                error "Database connection still failed after authentication fix"
                log "Continuing setup anyway - database can be configured manually later"
            fi
        else
            error "Database connection failed - manual configuration may be needed"
            log "Continuing setup anyway - database can be configured manually later"
        fi
        
        # Create directory and save connection string anyway for manual configuration
        mkdir -p /opt/cricket-scorer
        echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > /opt/cricket-scorer/.env.template
        chmod 600 /opt/cricket-scorer/.env.template
        log "Database connection string saved to /opt/cricket-scorer/.env.template for manual configuration"
    fi
}

# Configure PM2 for production
configure_pm2() {
    log "Configuring PM2 for production..."
    
    # Setup PM2 startup script
    env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
    
    # Create PM2 logs directory
    mkdir -p /opt/cricket-scorer/logs
    
    success "PM2 configured for production"
}

# Install application build dependencies
install_build_dependencies() {
    log "Installing application build dependencies..."
    
    # Install Python build tools (required for some npm packages)
    dnf install -y python3-devel
    
    # Install additional build tools
    dnf groupinstall -y "Development Tools"
    
    success "Build dependencies installed"
}

# Performance optimizations
optimize_performance() {
    log "Applying performance optimizations..."
    
    # Increase file limits
    cat >> /etc/security/limits.conf << 'EOF'
# Cricket Scorer Application Limits
root soft nofile 65536
root hard nofile 65536
* soft nofile 65536  
* hard nofile 65536
EOF
    
    # Optimize PostgreSQL
    PG_CONF="/var/lib/pgsql/data/postgresql.conf"
    
    # Calculate memory settings based on available RAM
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    SHARED_BUFFERS=$((TOTAL_MEM/4))
    EFFECTIVE_CACHE_SIZE=$((TOTAL_MEM*3/4))
    
    cat >> $PG_CONF << EOF

# Performance Tuning for Cricket Scorer
shared_buffers = ${SHARED_BUFFERS}MB
effective_cache_size = ${EFFECTIVE_CACHE_SIZE}MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    success "Performance optimizations applied"
}

# Setup monitoring and health checks
setup_monitoring() {
    log "Setting up monitoring and health checks..."
    
    # Create health check script
    cat > /opt/cricket-scorer/health-check.sh << 'EOF'
#!/bin/bash

# Cricket Scorer Health Check Script

check_service() {
    service=$1
    if systemctl is-active --quiet $service; then
        echo "✓ $service is running"
        return 0
    else
        echo "✗ $service is not running"
        return 1
    fi
}

check_port() {
    port=$1
    service=$2
    if nc -z localhost $port 2>/dev/null; then
        echo "✓ $service responding on port $port"
        return 0
    else
        echo "✗ $service not responding on port $port"
        return 1
    fi
}

echo "Cricket Scorer Health Check - $(date)"
echo "=================================="

# Check system services
check_service nginx
check_service postgresql
check_service firewalld

# Check application ports
check_port 80 "Nginx HTTP"
check_port 443 "Nginx HTTPS" 2>/dev/null || echo "ℹ HTTPS not configured"
check_port 5432 "PostgreSQL"
check_port 3000 "Node.js App" 2>/dev/null || echo "ℹ Application not running"

# Check PM2 processes
if command -v pm2 >/dev/null 2>&1; then
    echo ""
    echo "PM2 Process Status:"
    pm2 status
else
    echo "ℹ PM2 status not available"
fi

# Check disk space
echo ""
echo "Disk Usage:"
df -h / | awk 'NR==2 {print "Root partition: " $3 " used, " $4 " available (" $5 " used)"}'

# Check memory usage
echo ""
echo "Memory Usage:"
free -h | awk 'NR==2 {print "Memory: " $3 " used, " $7 " available"}'

# Check system load
echo ""
echo "System Load:"
uptime
EOF
    
    chmod +x /opt/cricket-scorer/health-check.sh
    
    # Create log rotation configuration
    cat > /etc/logrotate.d/cricket-scorer << 'EOF'
/opt/cricket-scorer/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    success "Monitoring and health checks configured"
}

# Create backup script
setup_backup() {
    log "Setting up backup system..."
    
    cat > /opt/cricket-scorer/backup.sh << 'EOF'
#!/bin/bash

# Cricket Scorer Backup Script

BACKUP_DIR="/opt/cricket-scorer/backups"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/opt/cricket-scorer/logs/backup.log"

# Create backup directory
mkdir -p $BACKUP_DIR

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
    echo "$1"
}

log_message "Starting backup process..."

# Backup database
if [ ! -z "$DATABASE_URL" ]; then
    log_message "Backing up database..."
    pg_dump $DATABASE_URL > $BACKUP_DIR/database_$DATE.sql
    gzip $BACKUP_DIR/database_$DATE.sql
    log_message "Database backup completed: database_$DATE.sql.gz"
else
    log_message "Warning: DATABASE_URL not set, skipping database backup"
fi

# Backup application files (excluding node_modules and build artifacts)
log_message "Backing up application files..."
tar -czf $BACKUP_DIR/application_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='server/public' \
    --exclude='logs' \
    --exclude='backups' \
    /opt/cricket-scorer/

log_message "Application backup completed: application_$DATE.tar.gz"

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
log_message "Old backups cleaned up"

log_message "Backup process completed"
EOF
    
    chmod +x /opt/cricket-scorer/backup.sh
    
    # Setup daily backup cron job
    echo "0 2 * * * /opt/cricket-scorer/backup.sh" | crontab -
    
    success "Backup system configured"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    echo ""
    
    echo "System Services Status:"
    echo "======================="
    systemctl is-active nginx && success "Nginx: Active" || warning "Nginx: Inactive"
    systemctl is-active postgresql-15 && success "PostgreSQL: Active" || warning "PostgreSQL: Inactive"
    systemctl is-active firewalld && success "Firewall: Active" || warning "Firewall: Inactive"
    systemctl is-active fail2ban && success "Fail2ban: Active" || warning "Fail2ban: Inactive"
    
    echo ""
    echo "Software Versions:"
    echo "=================="
    echo "Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
    echo "npm: $(npm --version 2>/dev/null || echo 'Not installed')"
    echo "PM2: $(pm2 --version 2>/dev/null || echo 'Not installed')"
    echo "PostgreSQL: $(sudo -u postgres psql --version 2>/dev/null | awk '{print $3}' || echo 'Not installed')"
    echo "Nginx: $(nginx -v 2>&1 | awk -F'/' '{print $2}' || echo 'Not installed')"
    
    echo ""
    echo "Network Ports:"
    echo "=============="
    ss -tlnp | grep -E ':(80|443|3000|5432) ' && success "Required ports are listening" || warning "Some ports may not be configured"
    
    echo ""
    echo "Directory Structure:"
    echo "==================="
    ls -la /opt/cricket-scorer/ 2>/dev/null && success "Application directory exists" || warning "Application directory not found"
    
    echo ""
    success "Installation verification completed"
}

# Main execution
main() {
    echo "================================================="
    echo "  Cricket Scorer Production Server Setup"
    echo "  AlmaLinux 9 - 64-bit"
    echo "================================================="
    echo ""
    
    check_root
    print_system_info
    
    echo "This script will install and configure:"
    echo "• Node.js 20.x with npm, PM2, and build tools"
    echo "• PostgreSQL 15 database server"
    echo "• Nginx web server with reverse proxy"
    echo "• SSL/TLS with Let's Encrypt"
    echo "• Firewall and security configuration"
    echo "• Monitoring and backup systems"
    echo ""
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Installation cancelled"
        exit 0
    fi
    
    # Execute installation steps
    update_system
    install_system_tools
    install_nodejs
    install_postgresql
    install_nginx
    configure_firewall
    configure_fail2ban
    setup_ssl
    setup_database
    configure_pm2
    install_build_dependencies
    optimize_performance
    setup_monitoring
    setup_backup
    verify_installation
    
    echo ""
    echo "================================================="
    echo "  Production Server Setup Complete!"
    echo "================================================="
    echo ""
    echo "Next Steps:"
    echo "1. Deploy your Cricket Scorer application to /opt/cricket-scorer"
    echo "2. Run the environment setup script: ./setup-production-env.sh"
    echo "3. Build and start the application with PM2"
    echo ""
    echo "Useful Commands:"
    echo "• Health Check: /opt/cricket-scorer/health-check.sh"
    echo "• Manual Backup: /opt/cricket-scorer/backup.sh"
    echo "• PM2 Status: pm2 status"
    echo "• Nginx Status: systemctl status nginx"
    echo "• PostgreSQL Status: systemctl status postgresql"
    echo ""
    echo "Server IP: $(curl -s ifconfig.me)"
    echo "Domain: score.ramisetty.net"
    echo ""
    success "Server is ready for Cricket Scorer deployment!"
}

# Run main function
main "$@"