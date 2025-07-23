#!/bin/bash

# Production deployment with OpenAI API key
# Auto-generated from deploy-with-secrets.sh

export OPENAI_API_KEY='33690636c1984fc9b348bc2022b77e1f'

cd /opt/cricket-scorer

# Update .env file with API key
echo 'Updating .env file with OpenAI API key...'
cat > .env <<EOF
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer
OPENAI_API_KEY=33690636c1984fc9b348bc2022b77e1f
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
      OPENAI_API_KEY: '33690636c1984fc9b348bc2022b77e1f'
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

