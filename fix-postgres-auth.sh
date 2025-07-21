#!/bin/bash

# Quick fix for PostgreSQL authentication issue
# Run this script if the main setup script is asking for postgres password

echo "Fixing PostgreSQL authentication..."

# Set up PostgreSQL to allow local connections without password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres123';" 2>/dev/null || true

# Update pg_hba.conf to allow connections
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"

if [ -f "$PG_HBA" ]; then
    echo "Updating pg_hba.conf..."
    
    # Backup original
    cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Add md5 authentication for TCP connections
    if ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA"; then
        echo "host    all             all             127.0.0.1/32            md5" >> "$PG_HBA"
    fi
    
    if ! grep -q "host.*all.*all.*::1/128.*md5" "$PG_HBA"; then
        echo "host    all             all             ::1/128                 md5" >> "$PG_HBA"
    fi
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    echo "PostgreSQL authentication fixed. You can now continue with the main script."
else
    echo "Error: pg_hba.conf not found at $PG_HBA"
    echo "Please check PostgreSQL installation."
fi