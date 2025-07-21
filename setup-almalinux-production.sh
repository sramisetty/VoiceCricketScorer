#!/bin/bash

# Cricket Scorer Production Server Setup for AlmaLinux 9
# This script sets up all dependencies and infrastructure for production deployment

set -e  # Exit on any error

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
        python3-certbot-nginx
    
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
    
    # Install PostgreSQL 15 repository
    dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    
    # Install PostgreSQL 15
    dnf install -y postgresql15-server postgresql15-devel postgresql15-contrib
    
    # Initialize database if not already done
    if [ ! -f /var/lib/pgsql/15/data/postgresql.conf ]; then
        log "Initializing PostgreSQL database..."
        /usr/pgsql-15/bin/postgresql-15-setup initdb
    fi
    
    # Enable and start PostgreSQL
    systemctl enable postgresql-15
    systemctl start postgresql-15
    
    # Wait for PostgreSQL to start
    sleep 5
    
    # Configure PostgreSQL for application access
    log "Configuring PostgreSQL..."
    
    # Update postgresql.conf
    PG_CONF="/var/lib/pgsql/15/data/postgresql.conf"
    cp $PG_CONF ${PG_CONF}.backup
    
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF
    sed -i "s/#port = 5432/port = 5432/" $PG_CONF
    sed -i "s/#max_connections = 100/max_connections = 200/" $PG_CONF
    
    # Update pg_hba.conf for authentication
    PG_HBA="/var/lib/pgsql/15/data/pg_hba.conf"
    cp $PG_HBA ${PG_HBA}.backup
    
    # Add application access
    cat >> $PG_HBA << EOF

# Cricket Scorer Application Access
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF
    
    # Restart PostgreSQL with new configuration
    systemctl restart postgresql-15
    
    success "PostgreSQL 15 installed and configured"
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
    
    # Check if domain resolves to this server
    DOMAIN="score.ramisetty.net"
    SERVER_IP=$(curl -s ifconfig.me)
    DOMAIN_IP=$(dig +short $DOMAIN)
    
    if [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
        log "Domain resolves correctly. Obtaining SSL certificate..."
        
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Obtain certificate
        certbot certonly --standalone \
            --non-interactive \
            --agree-tos \
            --email admin@ramisetty.net \
            -d $DOMAIN
        
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
        
        # Start nginx
        systemctl start nginx
        nginx -t && systemctl reload nginx
        
        success "SSL certificate installed and configured"
    else
        warning "Domain does not resolve to this server. SSL setup skipped."
        warning "Current server IP: $SERVER_IP"
        warning "Domain resolves to: $DOMAIN_IP"
        warning "Please update DNS records and run SSL setup manually later."
    fi
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
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF
    
    # Test connection
    export PGPASSWORD=$DB_PASSWORD
    if psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" >/dev/null 2>&1; then
        success "Database created and connection tested successfully"
        
        # Save database URL for later use
        echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > /opt/cricket-scorer/.env.template
        chmod 600 /opt/cricket-scorer/.env.template
        
        log "Database connection string saved to /opt/cricket-scorer/.env.template"
    else
        error "Database connection test failed"
        exit 1
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
    PG_CONF="/var/lib/pgsql/15/data/postgresql.conf"
    
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
    systemctl restart postgresql-15
    
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
check_service postgresql-15
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
    echo "• PostgreSQL Status: systemctl status postgresql-15"
    echo ""
    echo "Server IP: $(curl -s ifconfig.me)"
    echo "Domain: score.ramisetty.net"
    echo ""
    success "Server is ready for Cricket Scorer deployment!"
}

# Run main function
main "$@"