#!/bin/bash

# Fix nginx to serve Cricket Scorer instead of test page
echo "=== Fixing Nginx Configuration for Cricket Scorer ==="

# Stop nginx
echo "Stopping nginx..."
systemctl stop nginx 2>/dev/null || true

# Remove all existing configurations that might conflict
echo "Removing conflicting configurations..."
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
rm -f /etc/nginx/sites-available/default 2>/dev/null || true
rm -f /etc/nginx/conf.d/* 2>/dev/null || true
rm -f /var/www/html/index.html 2>/dev/null || true
rm -f /usr/share/nginx/html/index.html 2>/dev/null || true

# Create directories
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d

# Create new Cricket Scorer configuration
echo "Creating Cricket Scorer nginx configuration..."
cat > /etc/nginx/sites-available/cricket-scorer << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name score.ramisetty.net www.score.ramisetty.net _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name score.ramisetty.net www.score.ramisetty.net _;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/score.ramisetty.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/score.ramisetty.net/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable the site
echo "Enabling Cricket Scorer site..."
ln -sf /etc/nginx/sites-available/cricket-scorer /etc/nginx/sites-enabled/cricket-scorer

# Also add to conf.d for compatibility
cp /etc/nginx/sites-available/cricket-scorer /etc/nginx/conf.d/cricket-scorer.conf

# Ensure nginx.conf includes sites-enabled
echo "Updating nginx.conf..."
if [ -f "/etc/nginx/nginx.conf" ]; then
    if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
        sed -i '/http {/a\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    fi
fi

# Test configuration
echo "Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Nginx configuration is valid"
    
    # Start nginx
    echo "Starting nginx..."
    systemctl start nginx
    systemctl enable nginx
    
    # Wait a moment
    sleep 3
    
    # Test the result
    echo "Testing website access..."
    if curl -f -s -H 'Host: score.ramisetty.net' http://localhost/ | grep -q "Cricket Scorer"; then
        echo "✓ SUCCESS: Cricket Scorer is now being served by nginx!"
        echo "✓ Website should be accessible at: https://score.ramisetty.net"
    else
        echo "⚠ Nginx started but may still be serving cached content"
        echo "Try: systemctl reload nginx"
    fi
else
    echo "✗ Nginx configuration test failed"
    exit 1
fi

echo ""
echo "=== Final Steps ==="
echo "1. Clear your browser cache"
echo "2. Visit: https://score.ramisetty.net"
echo "3. If still showing test page, run: systemctl reload nginx"