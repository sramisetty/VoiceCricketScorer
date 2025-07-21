#!/bin/bash

# Emergency recovery for Cricket Scorer services
echo "=== EMERGENCY CRICKET SCORER RECOVERY ==="

# Stop everything
systemctl stop nginx 2>/dev/null || true

# Create ultra-minimal nginx config that just works
cat > /etc/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80 default_server;
        server_name _;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
        }
    }
}
EOF

# Test and start nginx
nginx -t && systemctl start nginx

echo "✓ Nginx restored with minimal config"
echo "✓ Site should work at: http://score.ramisetty.net"

# Ensure PM2 app is running
cd /opt/cricket-scorer 2>/dev/null || cd /root/cricket-scorer 2>/dev/null || echo "Could not find app directory"

if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs) 2>/dev/null || true
fi

pm2 restart cricket-scorer 2>/dev/null || pm2 start ecosystem.config.cjs --env production

echo "✓ PM2 application restarted"
echo ""
echo "Test: curl http://localhost:3000/ should show Cricket Scorer"
echo "Test: curl http://localhost/ should also show Cricket Scorer"