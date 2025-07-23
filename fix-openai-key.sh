#!/bin/bash

# Fix OpenAI API Key in Production Environment
# Run this script on production server to set the OpenAI API key

set -e

APP_DIR="/opt/cricket-scorer"

# Check if we're on production server
if [ "$(hostname -I 2>/dev/null | grep -o '67.227.251.94')" ]; then
    echo "✓ Running on production server (67.227.251.94)"
elif [ -d "/nix/store" ]; then
    echo "⚠ This is the development environment (Replit)"
    echo "This script is for the production server. Please run on 67.227.251.94"
    exit 0
else
    echo "Production environment detected"
fi

if [ ! -d "$APP_DIR" ]; then
    echo "✗ Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

echo "=== Setting OpenAI API Key ==="

# Check if OPENAI_API_KEY is already set
if [ -f ".env" ] && grep -q "OPENAI_API_KEY=" .env; then
    CURRENT_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d'=' -f2)
    if [ -n "$CURRENT_KEY" ] && [ "$CURRENT_KEY" != '""' ] && [ "$CURRENT_KEY" != "" ]; then
        echo "✓ OpenAI API key is already set in .env"
        echo "Current key: ${CURRENT_KEY:0:10}..."
        
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Keeping existing key..."
            # Still need to update PM2 config
            UPDATE_PM2_ONLY=true
        fi
    fi
fi

if [ "$UPDATE_PM2_ONLY" != "true" ]; then
    # Check if OPENAI_API_KEY is provided as environment variable (from deploy script)
    if [ -n "$OPENAI_API_KEY" ]; then
        echo "✓ Using OpenAI API key from environment"
    else
        echo "Please enter your OpenAI API key:"
        echo "(It should start with 'sk-proj-' or 'sk-')"
        read -s -p "OpenAI API Key: " OPENAI_API_KEY
        echo

        if [ -z "$OPENAI_API_KEY" ]; then
            echo "✗ No API key provided"
            exit 1
        fi

        if [[ ! "$OPENAI_API_KEY" =~ ^sk- ]]; then
            echo "⚠ Warning: API key doesn't start with 'sk-'"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi

    # Update .env file
    echo "Updating .env file..."
    if [ -f ".env" ]; then
        # Update existing key
        sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$OPENAI_API_KEY/" .env
    else
        # Create new .env file
        cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
OPENAI_API_KEY=$OPENAI_API_KEY
NODE_ENV=production
PORT=3000
EOF
    fi
    echo "✓ Updated .env file"
else
    # Read existing key for PM2 config
    OPENAI_API_KEY=$(grep "OPENAI_API_KEY=" .env | cut -d'=' -f2)
fi

# Update PM2 ecosystem config
echo "Updating PM2 configuration..."
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://cricket_user:simple123@localhost:5432/cricket_scorer',
      OPENAI_API_KEY: '$OPENAI_API_KEY'
    },
    error_file: '/var/log/cricket-scorer-error.log',
    out_file: '/var/log/cricket-scorer-out.log',
    log_file: '/var/log/cricket-scorer.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100
  }]
};
EOF

echo "✓ Updated PM2 configuration"

# Restart PM2 application
echo "Restarting Cricket Scorer application..."
pm2 restart cricket-scorer

echo "Waiting for application to start..."
sleep 10

# Test application
echo "Testing application..."
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo "✓ Application is responding successfully!"
    echo ""
    echo "=== PM2 Status ==="
    pm2 list
    echo ""
    echo "=== Application Test ==="
    curl -s http://localhost:3000/api/teams | head -200
    echo ""
    echo "✓ OpenAI API key configuration completed!"
    echo "Application is now available at: http://localhost:3000"
    echo "External access: https://score.ramisetty.net"
else
    echo "✗ Application not responding, checking logs..."
    pm2 logs cricket-scorer --lines 10
    exit 1
fi