#!/bin/bash

# Load environment variables and run database test
echo "=== Loading Environment and Testing Database ==="
echo ""

# Check current directory
if [ ! -f "package.json" ]; then
    echo "Changing to application directory..."
    cd /opt/cricket-scorer || cd /root/cricket-scorer || {
        echo "Error: Could not find application directory"
        exit 1
    }
fi

echo "Current directory: $(pwd)"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "✗ .env file not found in $(pwd)"
    echo "Please ensure .env file exists with DATABASE_URL configuration"
    exit 1
fi

echo "✓ Found .env file"

# Show DATABASE_URL (masked)
if grep -q "DATABASE_URL" .env; then
    DATABASE_URL_LINE=$(grep "DATABASE_URL" .env | head -1)
    echo "✓ DATABASE_URL found: ${DATABASE_URL_LINE//:*@/:***@}"
else
    echo "✗ DATABASE_URL not found in .env file"
    exit 1
fi

# Load environment variables
echo ""
echo "Loading environment variables..."
set -a  # automatically export all variables
source .env
set +a  # stop auto-exporting

# Verify DATABASE_URL is loaded
if [ -n "$DATABASE_URL" ]; then
    echo "✓ DATABASE_URL loaded into environment"
else
    echo "✗ Failed to load DATABASE_URL"
    exit 1
fi

# Run database test
echo ""
echo "Running database connection test..."
if [ -f "quick-database-test.cjs" ]; then
    node quick-database-test.cjs
elif [ -f "test-database-connection.js" ]; then
    node test-database-connection.js
else
    echo "⚠ No database test scripts found"
    echo "Testing with psql directly..."
    
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
            echo "✓ Database connection successful"
            echo "PostgreSQL version: $(psql "$DATABASE_URL" -t -c "SELECT version();" | head -1 | xargs)"
        else
            echo "✗ Database connection failed"
            echo "Check PostgreSQL service and credentials"
        fi
    else
        echo "✗ psql command not available"
    fi
fi

echo ""
echo "Environment and database test completed!"