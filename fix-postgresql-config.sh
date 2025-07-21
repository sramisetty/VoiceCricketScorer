#!/bin/bash

# Direct PostgreSQL configuration fix script
# This script directly replaces the corrupted PostgreSQL configuration

set -e

echo "=== PostgreSQL Configuration Emergency Fix ==="

PG_DATA_DIR="/var/lib/pgsql/data"
PG_CONF="$PG_DATA_DIR/postgresql.conf"

# Stop PostgreSQL if running
systemctl stop postgresql 2>/dev/null || true

# Backup corrupted config
if [ -f "$PG_CONF" ]; then
    cp "$PG_CONF" "$PG_CONF.corrupted.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Backed up corrupted configuration"
fi

# Create clean minimal configuration
echo "Creating minimal PostgreSQL configuration..."
cat > "$PG_CONF" << 'EOF'
# PostgreSQL Configuration - Cricket Scorer
# Generated automatically

# Connection Settings
max_connections = 100
port = 5432

# Memory Settings
shared_buffers = 128MB
effective_cache_size = 4GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL Settings
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query Planner Settings
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging Settings
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
log_rotation_age = 1d
log_rotation_size = 10MB
log_min_duration_statement = 1000

# Locale Settings
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.UTF-8'
lc_monetary = 'en_US.UTF-8'
lc_numeric = 'en_US.UTF-8'
lc_time = 'en_US.UTF-8'

# Shared Library Settings
dynamic_shared_memory_type = posix

# SSL Settings (if certificates exist)
ssl = off
EOF

# Set proper ownership and permissions
chown postgres:postgres "$PG_CONF"
chmod 600 "$PG_CONF"

echo "✓ Created new PostgreSQL configuration"

# Verify configuration syntax
echo "Testing PostgreSQL configuration..."
if sudo -u postgres /usr/bin/postgres --config-file="$PG_CONF" -C shared_buffers 2>/dev/null; then
    echo "✓ PostgreSQL configuration is valid"
    
    # Show key parameter values
    echo "Configuration parameters:"
    echo "  shared_buffers: $(sudo -u postgres /usr/bin/postgres --config-file="$PG_CONF" -C shared_buffers 2>/dev/null)"
    echo "  effective_cache_size: $(sudo -u postgres /usr/bin/postgres --config-file="$PG_CONF" -C effective_cache_size 2>/dev/null)"
    
    # Start PostgreSQL
    echo "Starting PostgreSQL service..."
    if systemctl start postgresql; then
        echo "✓ PostgreSQL started successfully"
        systemctl enable postgresql
        
        # Test database connection
        if sudo -u postgres psql -c "SELECT version();" 2>/dev/null; then
            echo "✓ Database connection test passed"
        else
            echo "⚠ Database connection test failed"
        fi
        
    else
        echo "✗ PostgreSQL failed to start"
        systemctl status postgresql --no-pager -l
    fi
    
else
    echo "✗ PostgreSQL configuration is still invalid"
    echo "Configuration test output:"
    sudo -u postgres /usr/bin/postgres --config-file="$PG_CONF" -C shared_buffers 2>&1 || true
fi

echo "=== PostgreSQL Fix Complete ==="