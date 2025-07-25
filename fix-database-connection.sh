#!/bin/bash

# Fix database connection issues on production server
echo "=== Score Pro Database Connection Fix ==="
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

# Load environment variables
if [ -f ".env" ]; then
    echo "Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs) 2>/dev/null
    echo "✓ Environment variables loaded"
else
    echo "⚠ No .env file found"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "✗ DATABASE_URL not set"
    echo "Please set DATABASE_URL in your .env file"
    echo "Example: DATABASE_URL=postgresql://cricket_scorer:simple123@localhost/cricket_scorer"
    exit 1
fi

echo "DATABASE_URL is configured"

# Test database connection using Node.js
echo ""
echo "Testing database connection..."
if [ -f "quick-database-test.cjs" ]; then
    node quick-database-test.cjs
elif [ -f "test-database-connection.js" ]; then
    node test-database-connection.js
else
    echo "⚠ Database test scripts not found"
    echo "Testing with psql instead..."
    
    # Try to connect with psql
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
            echo "✓ Database connection successful with psql"
        else
            echo "✗ Database connection failed with psql"
            echo ""
            echo "Common fixes:"
            echo "1. Check if PostgreSQL is running:"
            echo "   sudo systemctl status postgresql"
            echo "   sudo systemctl start postgresql"
            echo ""
            echo "2. Check if database exists:"
            echo "   sudo -u postgres psql -c \"\\l\""
            echo ""
            echo "3. Create database if needed:"
            echo "   sudo -u postgres createdb cricket_scorer"
            echo ""
            echo "4. Create user if needed:"
            echo "   sudo -u postgres psql -c \"CREATE USER cricket_scorer WITH PASSWORD 'simple123';\""
            echo "   sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_scorer;\""
        fi
    else
        echo "⚠ psql command not found"
        echo "Install with: sudo apt update && sudo apt install postgresql-client"
    fi
fi

# Check if tables exist and run migrations if needed
echo ""
echo "Checking database schema..."
if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" >/dev/null 2>&1; then
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    echo "Found $TABLE_COUNT tables in database"
    
    if [ "$TABLE_COUNT" -eq "0" ]; then
        echo "⚠ No tables found. Running database migrations..."
        if [ -f "package.json" ]; then
            npm run db:push 2>/dev/null || {
                echo "Migration failed. Try running manually:"
                echo "npm run db:push"
            }
        else
            echo "⚠ package.json not found. Cannot run migrations."
        fi
    else
        echo "✓ Database schema appears to be set up"
    fi
else
    echo "⚠ Could not check database schema"
fi

# Restart application to ensure it picks up any fixes
echo ""
echo "Restarting application..."
pm2 restart cricket-scorer 2>/dev/null || pm2 start ecosystem.config.cjs --env production

echo ""
echo "Database connection fix completed!"
echo "Check the application status with: ./check-production-status.sh"