#!/bin/bash

# Deploy Cricket Scorer with OpenAI API Key
# This script deploys the application and includes the OpenAI API key from Replit environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if OPENAI_API_KEY is available
if [ -z "$OPENAI_API_KEY" ]; then
    error "OPENAI_API_KEY not found in environment"
    echo "This script must be run from the Replit environment where the API key is available"
    exit 1
fi

log "✓ OpenAI API Key found: ${OPENAI_API_KEY:0:10}..."

# Get the actual API key to use in the deployment
PRODUCTION_OPENAI_KEY="$OPENAI_API_KEY"

# Create the production deployment command
DEPLOY_COMMAND="#!/bin/bash

# Production deployment with OpenAI API key
# Auto-generated from deploy-with-secrets.sh

export OPENAI_API_KEY='$PRODUCTION_OPENAI_KEY'

cd /opt/cricket-scorer

# Update .env file with API key
echo 'Updating .env file with OpenAI API key...'
cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
OPENAI_API_KEY=$PRODUCTION_OPENAI_KEY
NODE_ENV=production
PORT=3000
EOF

# Update PM2 ecosystem configuration
echo 'Updating PM2 configuration...'
cat > ecosystem.config.cjs <<EOF
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
      OPENAI_API_KEY: '$PRODUCTION_OPENAI_KEY'
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

echo 'Restarting application with PM2...'
pm2 restart cricket-scorer

echo 'Waiting for application to start...'
sleep 10

echo 'Testing application...'
if curl -f -s http://localhost:3000/api/teams >/dev/null 2>&1; then
    echo '✓ Application is responding successfully!'
    echo ''
    echo '=== PM2 Status ==='
    pm2 list
    echo ''
    echo '✓ Cricket Scorer deployment completed!'
    echo 'Application available at: https://score.ramisetty.net'
else
    echo '✗ Application not responding, checking logs...'
    pm2 logs cricket-scorer --lines 20
    exit 1
fi
"

# Save the deployment command to a temporary file
echo "$DEPLOY_COMMAND" > production-deploy-with-key.sh
chmod +x production-deploy-with-key.sh

log "✓ Created production deployment script: production-deploy-with-key.sh"
log ""
log "To deploy to production:"
log "1. Copy this script to your production server:"
log "   scp production-deploy-with-key.sh root@67.227.251.94:/opt/cricket-scorer/"
log ""
log "2. Run it on the production server:"
log "   ssh root@67.227.251.94"
log "   cd /opt/cricket-scorer"
log "   ./production-deploy-with-key.sh"
log ""
log "The script includes your OpenAI API key and will:"
log "• Update the .env file with the API key"
log "• Update PM2 configuration with environment variables"
log "• Restart the application"
log "• Test that it's working"
log ""
warning "Keep this script secure as it contains your API key!"