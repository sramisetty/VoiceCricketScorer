# Cricket Scorer Production Deployment Guide

## Overview
Complete deployment guide for the Voice-Enabled Cricket Scoring Application on AlmaLinux 9 production server.

**Server Details:**
- **OS:** AlmaLinux 9 (64-bit)
- **Public IP:** 67.227.251.94
- **Domain:** score.ramisetty.net
- **Database:** PostgreSQL
- **Process Manager:** PM2
- **Web Server:** Nginx with SSL

## Prerequisites
1. Root access to AlmaLinux 9 server (67.227.251.94)
2. Domain score.ramisetty.net with DNS A record pointing to 67.227.251.94
3. Email address for SSL certificate generation

## Quick Deployment (Recommended)

### Option 1: Run the Automated Script

1. **Upload the deployment script to your server:**
   ```bash
   scp production-deploy.sh root@67.227.251.94:/root/
   ```

2. **SSH into your server:**
   ```bash
   ssh root@67.227.251.94
   ```

3. **Run the deployment script:**
   ```bash
   chmod +x production-deploy.sh
   ./production-deploy.sh
   ```

The script will automatically:
- ✅ Update AlmaLinux system packages
- ✅ Install Node.js 20 with npm
- ✅ Install and configure PostgreSQL
- ✅ Create database and user
- ✅ Set up application user and directories
- ✅ Deploy application code
- ✅ Install dependencies and build the app
- ✅ Sync database schema with Drizzle
- ✅ Configure PM2 with cluster mode
- ✅ Install and configure Nginx
- ✅ Generate SSL certificate with Let's Encrypt
- ✅ Configure firewall rules
- ✅ Test all services and connections
- ✅ Create status monitoring script

**Expected Runtime:** 10-15 minutes

## Manual Deployment Steps (Alternative)

If you prefer manual deployment or need to troubleshoot, follow these detailed steps:

### Phase 1: System Preparation
```bash
# Update system
dnf update -y
dnf install -y epel-release
dnf groupinstall -y "Development Tools"
```

### Phase 2: Node.js Installation
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
npm install -g pm2@latest
```

### Phase 3: PostgreSQL Setup
```bash
# Install PostgreSQL
dnf install -y postgresql postgresql-server postgresql-contrib
postgresql-setup --initdb
systemctl start postgresql
systemctl enable postgresql

# Configure authentication
sudo -u postgres psql << EOF
CREATE USER cricket_user WITH PASSWORD 'CricketPass2025!';
CREATE DATABASE cricket_scorer OWNER cricket_user;
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
\q
EOF
```

### Phase 4: Application Deployment
```bash
# Create user and directories
useradd -r -s /bin/bash -d /opt/cricket-scorer -m cricketapp
cd /opt/cricket-scorer

# Copy application files (your actual files)
# Install dependencies
npm install

# Set environment variables
echo "DATABASE_URL=postgresql://cricket_user:CricketPass2025!@localhost:5432/cricket_scorer" > .env
echo "NODE_ENV=production" >> .env
echo "PORT=3000" >> .env

# Build application
npm run build
npm run db:push
```

### Phase 5: PM2 Configuration
```bash
# Create PM2 config
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3000 }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Phase 6: Nginx and SSL
```bash
# Install Nginx and Certbot
dnf install -y nginx certbot python3-certbot-nginx

# Configure Nginx (see script for full config)
# Generate SSL certificate
certbot --nginx -d score.ramisetty.net

# Configure firewall
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

## Application Features

The deployed application includes:

### Core Features
- **Voice Recognition:** Real-time cricket scoring using voice commands
- **Live Scoreboard:** WebSocket-powered real-time updates
- **ICC Compliance:** Complete cricket rules implementation
- **Match Management:** Team setup, player management, match statistics
- **Mobile Responsive:** Works on all devices

### Voice Commands
- "four" or "boundary" → 4 runs
- "six" or "maximum" → 6 runs
- "single" or "one" → 1 run
- "double" or "two" → 2 runs
- "dot ball" or "no run" → 0 runs
- Enhanced phonetic matching for accuracy

### Technical Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + WebSocket
- **Database:** PostgreSQL with Drizzle ORM
- **Process Manager:** PM2 cluster mode
- **Web Server:** Nginx with SSL
- **Real-time:** WebSocket for live updates

## Post-Deployment Testing

After deployment, verify these components:

### 1. Application Access
```bash
# Test HTTP access
curl http://localhost:3000

# Test HTTPS access
curl https://score.ramisetty.net
```

### 2. Database Connection
```bash
# Test database
sudo -u postgres psql cricket_scorer -c "SELECT version();"
```

### 3. PM2 Status
```bash
# Check PM2 processes
sudo -u cricketapp pm2 list
sudo -u cricketapp pm2 logs cricket-scorer
```

### 4. Services Status
```bash
# Check all services
systemctl status postgresql
systemctl status nginx
systemctl status firewalld
```

### 5. Comprehensive Status Check
```bash
# Run the automated status check
bash /opt/cricket-scorer-status.sh
```

## Troubleshooting

### Common Issues and Solutions

**1. 502 Bad Gateway Error**
```bash
# Check if PM2 is running
sudo -u cricketapp pm2 list
sudo -u cricketapp pm2 restart cricket-scorer
```

**2. Database Connection Error**
```bash
# Check PostgreSQL status
systemctl status postgresql
# Restart if needed
systemctl restart postgresql
```

**3. SSL Certificate Issues**
```bash
# Renew certificate
certbot renew --nginx
# Check certificate status
certbot certificates
```

**4. Port Not Accessible**
```bash
# Check firewall rules
firewall-cmd --list-all
# Add port if needed
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

### Log Locations
- **Application Logs:** `/opt/cricket-scorer/logs/`
- **Nginx Logs:** `/var/log/nginx/`
- **PostgreSQL Logs:** `/var/lib/pgsql/data/log/`
- **PM2 Logs:** `~/.pm2/logs/`

## Maintenance

### Regular Maintenance Tasks

**1. SSL Certificate Renewal (Automatic)**
```bash
# Check auto-renewal setup
crontab -l
# Manual renewal if needed
certbot renew --nginx
```

**2. System Updates**
```bash
# Update system packages
dnf update -y
# Restart services if needed
systemctl restart nginx
sudo -u cricketapp pm2 restart cricket-scorer
```

**3. Database Backups**
```bash
# Backup database
pg_dump -U cricket_user cricket_scorer > backup_$(date +%Y%m%d).sql
```

**4. Monitor Application**
```bash
# Check status regularly
bash /opt/cricket-scorer-status.sh
# Monitor logs
sudo -u cricketapp pm2 monit
```

## Security Notes

The deployment includes several security measures:
- ✅ Firewall configured with minimal open ports
- ✅ SSL/TLS encryption with Let's Encrypt
- ✅ Security headers in Nginx
- ✅ Non-root application user
- ✅ Database user with limited privileges
- ✅ Automatic security updates

## Support

**Access URLs:**
- **Production Site:** https://score.ramisetty.net
- **Direct IP:** http://67.227.251.94 (redirects to HTTPS)

**Server Access:**
```bash
ssh root@67.227.251.94
```

**Application Directory:**
```bash
cd /opt/cricket-scorer
```

## Final Notes

This deployment script provides a complete, production-ready Cricket Scorer application with:

1. **Zero Manual Intervention:** Fully automated deployment
2. **Production Security:** SSL, firewall, security headers
3. **High Availability:** PM2 cluster mode with auto-restart
4. **Monitoring:** Comprehensive logging and status checks
5. **Maintenance:** Automated SSL renewal and system updates

The application will be accessible at **https://score.ramisetty.net** with full voice-enabled cricket scoring functionality.

---

**Deployment Complete! 🏏**

Your voice-enabled cricket scoring platform is now live and ready for production use.