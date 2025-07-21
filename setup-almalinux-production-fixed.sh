#!/bin/bash

# Cricket Scorer AlmaLinux 9 Production Setup - Fixed PostgreSQL Dependencies
# This version resolves the perl(IPC::Run) dependency issue

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Log functions
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

# Install PostgreSQL with dependency fix
install_postgresql_fixed() {
    log "Installing PostgreSQL with dependency resolution..."
    
    # Install EPEL repository first
    dnf install -y epel-release
    
    # Install required Perl modules from EPEL
    log "Installing Perl dependencies..."
    dnf install -y perl-IPC-Run perl-Test-Simple perl-DBD-Pg \
                   perl-devel perl-CPAN perl-Time-HiRes \
                   openssl-devel readline-devel zlib-devel
    
    # Option 1: Use built-in AlmaLinux PostgreSQL (recommended for stability)
    log "Installing PostgreSQL from AlmaLinux repositories..."
    dnf module enable postgresql:15 -y
    dnf install -y postgresql-server postgresql postgresql-contrib postgresql-devel
    
    # Initialize database
    if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
        log "Initializing PostgreSQL database..."
        postgresql-setup --initdb
    fi
    
    # Enable and start PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql
    
    # Wait for PostgreSQL to start
    sleep 5
    
    # Configure PostgreSQL
    log "Configuring PostgreSQL..."
    
    # Update postgresql.conf
    PG_CONF="/var/lib/pgsql/data/postgresql.conf"
    cp $PG_CONF ${PG_CONF}.backup
    
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF
    sed -i "s/#port = 5432/port = 5432/" $PG_CONF
    sed -i "s/#max_connections = 100/max_connections = 200/" $PG_CONF
    
    # Update pg_hba.conf for authentication
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
    cp $PG_HBA ${PG_HBA}.backup
    
    # Add application access
    cat >> $PG_HBA << EOF

# Cricket Scorer Application Access
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF
    
    # Restart PostgreSQL with new configuration
    systemctl restart postgresql
    
    success "PostgreSQL installed and configured successfully"
}

# Alternative: Install PostgreSQL 15 from official repository with better error handling
install_postgresql_pgdg() {
    log "Installing PostgreSQL 15 from official repository..."
    
    # Install EPEL repository
    dnf install -y epel-release
    
    # Install comprehensive Perl environment
    log "Installing comprehensive Perl environment..."
    dnf groupinstall -y "Development Tools"
    dnf install -y perl-CPAN perl-IPC-Run perl-Test-Simple perl-DBD-Pg \
                   perl-devel perl-ExtUtils-MakeMaker perl-Module-Install \
                   openssl-devel readline-devel zlib-devel libxml2-devel \
                   libxslt-devel gcc gcc-c++ make cmake
    
    # Install PostgreSQL repository
    dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    
    # Update package cache
    dnf makecache
    
    # Install PostgreSQL 15 core packages
    log "Installing PostgreSQL 15 core packages..."
    dnf install -y postgresql15-server postgresql15 postgresql15-contrib
    
    # Try to install development packages with multiple fallback strategies
    log "Installing PostgreSQL development packages..."
    if dnf install -y postgresql15-devel; then
        success "PostgreSQL development packages installed successfully"
    elif dnf install -y postgresql15-devel --nobest --allowerasing; then
        success "PostgreSQL development packages installed with --nobest --allowerasing"
    elif dnf install -y postgresql15-devel --skip-broken; then
        success "PostgreSQL development packages installed with --skip-broken"
    else
        warning "PostgreSQL development packages unavailable, continuing without them"
        warning "Database functionality will work, but some development tools may be limited"
    fi
    
    # Initialize database
    if [ ! -f /var/lib/pgsql/15/data/postgresql.conf ]; then
        log "Initializing PostgreSQL database..."
        /usr/pgsql-15/bin/postgresql-15-setup initdb
    fi
    
    # Enable and start PostgreSQL
    systemctl enable postgresql-15
    systemctl start postgresql-15
    
    # Configure PostgreSQL (similar to above)
    log "Configuring PostgreSQL..."
    PG_CONF="/var/lib/pgsql/15/data/postgresql.conf"
    cp $PG_CONF ${PG_CONF}.backup
    
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF
    sed -i "s/#port = 5432/port = 5432/" $PG_CONF
    sed -i "s/#max_connections = 100/max_connections = 200/" $PG_CONF
    
    PG_HBA="/var/lib/pgsql/15/data/pg_hba.conf"
    cp $PG_HBA ${PG_HBA}.backup
    
    cat >> $PG_HBA << EOF

# Cricket Scorer Application Access
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF
    
    systemctl restart postgresql-15
    success "PostgreSQL 15 installed and configured successfully"
}

# Main function with user choice
main() {
    echo "================================================="
    echo "   Cricket Scorer PostgreSQL Installation Fix"
    echo "   AlmaLinux 9 Production Server"
    echo "================================================="
    echo ""
    
    check_root
    
    echo "Choose PostgreSQL installation method:"
    echo "1) Built-in AlmaLinux PostgreSQL (Recommended - more stable)"
    echo "2) Official PostgreSQL 15 repository (Latest version)"
    echo ""
    read -p "Enter choice [1-2]: " -n 1 -r
    echo
    
    case $REPLY in
        1)
            log "Installing PostgreSQL from AlmaLinux repositories..."
            install_postgresql_fixed
            ;;
        2)
            log "Installing PostgreSQL 15 from official repository..."
            install_postgresql_pgdg
            ;;
        *)
            log "Invalid choice, using default (AlmaLinux PostgreSQL)..."
            install_postgresql_fixed
            ;;
    esac
    
    echo ""
    echo "================================================="
    echo "   PostgreSQL Installation Completed!"
    echo "================================================="
    echo ""
    echo "PostgreSQL is now ready for Cricket Scorer deployment."
    echo ""
    echo "Next steps:"
    echo "1. Run the main deployment script: ./deploy-cricket-scorer.sh"
    echo "2. Or continue with the full setup: ./setup-almalinux-production.sh"
}

# Run the installation
main "$@"