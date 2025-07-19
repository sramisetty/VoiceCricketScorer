#!/bin/bash

# SSL/TLS Setup Script for Cricket Scorer Application
# This script configures HTTPS using Let's Encrypt SSL certificates

set -e

# Configuration
DOMAIN=""
EMAIL=""
APP_NAME="cricket-scorer"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
fi

# Get domain and email from user
get_domain_info() {
    if [ -z "$DOMAIN" ]; then
        echo -n "Enter your domain name (e.g., cricket.example.com): "
        read DOMAIN
    fi
    
    if [ -z "$EMAIL" ]; then
        echo -n "Enter your email address for Let's Encrypt: "
        read EMAIL
    fi
    
    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        error "Domain and email are required"
    fi
    
    log "Domain: $DOMAIN"
    log "Email: $EMAIL"
}

# Verify domain points to this server
verify_domain() {
    log "Verifying domain configuration..."
    
    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || curl -s ipecho.net/plain)
    
    # Check if domain resolves to this server
    DOMAIN_IP=$(dig +short "$DOMAIN" | tail -n1)
    
    if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
        warn "Domain $DOMAIN resolves to $DOMAIN_IP but server IP is $SERVER_IP"
        warn "Make sure your domain's A record points to $SERVER_IP"
        echo -n "Continue anyway? (y/N): "
        read CONTINUE
        if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
            exit 1
        fi
    else
        log "✓ Domain correctly points to this server"
    fi
}

# Update Nginx configuration for domain
update_nginx_for_domain() {
    log "Updating Nginx configuration for domain..."
    
    # Update the Nginx site configuration
    sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/cricket-scorer
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    log "✓ Nginx configuration updated"
}

# Obtain SSL certificate
obtain_ssl_certificate() {
    log "Obtaining SSL certificate from Let's Encrypt..."
    
    # Stop nginx temporarily to allow certbot to bind to port 80
    systemctl stop nginx
    
    # Obtain certificate
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    
    # Start nginx again
    systemctl start nginx
    
    log "✓ SSL certificate obtained"
}

# Configure Nginx with SSL
configure_nginx_ssl() {
    log "Configuring Nginx with SSL..."
    
    # Backup current configuration
    cp /etc/nginx/sites-available/cricket-scorer /etc/nginx/sites-available/cricket-scorer.backup
    
    # Create new SSL configuration
    cat > /etc/nginx/sites-available/cricket-scorer << EOF
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:;" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/x-font-ttf font/opentype image/svg+xml image/x-icon;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        
        # Additional headers for security
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Server \$host;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Static files with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    log "✓ Nginx configured with SSL"
}

# Setup automatic certificate renewal
setup_auto_renewal() {
    log "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > /usr/local/bin/renew-ssl-cricket-scorer << EOF
#!/bin/bash

# SSL Certificate Renewal Script for Cricket Scorer
certbot renew --quiet --deploy-hook "systemctl reload nginx"

# Log renewal attempt
echo "\$(date): SSL renewal check completed" >> /var/log/ssl-renewal.log
EOF
    
    chmod +x /usr/local/bin/renew-ssl-cricket-scorer
    
    # Add to crontab (run twice daily)
    (crontab -l 2>/dev/null; echo "0 */12 * * * /usr/local/bin/renew-ssl-cricket-scorer") | crontab -
    
    log "✓ Automatic renewal configured"
}

# Update application environment
update_app_environment() {
    log "Updating application environment for HTTPS..."
    
    # Update APP_URL in .env file
    sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|" /opt/cricket-scorer/current/.env
    
    # Restart application to pick up new environment
    systemctl restart cricket-scorer
    
    log "✓ Application environment updated"
}

# Test SSL configuration
test_ssl() {
    log "Testing SSL configuration..."
    
    # Wait for application to start
    sleep 5
    
    # Test HTTPS endpoint
    if curl -sf "https://$DOMAIN/health" >/dev/null; then
        log "✓ HTTPS endpoint test passed"
    else
        warn "HTTPS endpoint test failed"
    fi
    
    # Test HTTP redirect
    if curl -sf "http://$DOMAIN" 2>&1 | grep -q "301\|302"; then
        log "✓ HTTP to HTTPS redirect working"
    else
        warn "HTTP to HTTPS redirect may not be working"
    fi
}

# Display SSL information
show_ssl_info() {
    echo ""
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}                    SSL CONFIGURATION COMPLETED${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
    echo ""
    echo -e "${GREEN}Domain:${NC} $DOMAIN"
    echo -e "${GREEN}HTTPS URL:${NC} https://$DOMAIN"
    echo -e "${GREEN}Certificate Location:${NC} /etc/letsencrypt/live/$DOMAIN/"
    echo ""
    echo -e "${YELLOW}Certificate Information:${NC}"
    certbot certificates | grep -A 5 "$DOMAIN" || true
    echo ""
    echo -e "${YELLOW}SSL Test:${NC}"
    echo "Online SSL test: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
    echo ""
    echo -e "${YELLOW}Certificate Renewal:${NC}"
    echo "Automatic renewal is configured to run twice daily"
    echo "Manual renewal: certbot renew"
    echo ""
}

# Main function
main() {
    log "Starting SSL setup for Cricket Scorer..."
    
    get_domain_info
    verify_domain
    update_nginx_for_domain
    obtain_ssl_certificate
    configure_nginx_ssl
    setup_auto_renewal
    update_app_environment
    test_ssl
    show_ssl_info
    
    log "SSL setup completed successfully!"
    log "Your Cricket Scorer app is now available at: https://$DOMAIN"
}

# Run main function
main "$@"