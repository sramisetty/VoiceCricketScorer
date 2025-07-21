# Complete Production Deployment Guide
## Cricket Scorer - AlmaLinux 9 Production Server

This guide provides the complete three-script deployment process for the Cricket Scorer application on AlmaLinux 9.

## Prerequisites

- AlmaLinux 9 server (64-bit)
- Root access
- Domain name: score.ramisetty.net
- Server IP: 67.227.251.94
- Internet connectivity

## Deployment Scripts Overview

### 1. `setup-almalinux-production.sh` - Server Infrastructure Setup
**Purpose**: Sets up complete server infrastructure and dependencies
**Run Once**: Initial server setup or infrastructure updates

### 2. `setup-production-env.sh` - Environment Configuration  
**Purpose**: Interactive environment variable configuration
**Run**: During deployment or when updating configuration

### 3. `deploy-cricket-scorer.sh` - Application Deployment
**Purpose**: Complete application deployment from GitHub repository
**Run**: For each deployment or update

## Step-by-Step Deployment Process

### Phase 1: Server Infrastructure Setup

```bash
# 1. Upload setup script to server
scp setup-almalinux-production.sh root@67.227.251.94:/root/

# 2. Connect to server
ssh root@67.227.251.94

# 3. Run infrastructure setup (one-time only)
chmod +x setup-almalinux-production.sh
./setup-almalinux-production.sh
```

**What this script does:**
- ✅ Updates system packages
- ✅ Installs Node.js 20.x with npm
- ✅ Installs PostgreSQL 15 with optimized configuration
- ✅ Sets up Nginx with reverse proxy configuration
- ✅ Configures firewall and security (fail2ban)
- ✅ Installs SSL certificates (Let's Encrypt)
- ✅ Creates database and user for application
- ✅ Configures PM2 for process management
- ✅ Sets up monitoring and backup systems
- ✅ Applies performance optimizations

### Phase 2: Application Deployment

```bash
# 1. Upload deployment script to server
scp deploy-cricket-scorer.sh root@67.227.251.94:/root/
scp setup-production-env.sh root@67.227.251.94:/root/

# 2. Connect to server (if not already connected)
ssh root@67.227.251.94

# 3. Run application deployment
chmod +x deploy-cricket-scorer.sh
chmod +x setup-production-env.sh
./deploy-cricket-scorer.sh
```

**What this script does:**
- ✅ Validates prerequisites and dependencies
- ✅ Creates backup of existing deployment
- ✅ Clones/updates GitHub repository
- ✅ Runs interactive environment setup (if needed)
- ✅ Installs Node.js dependencies
- ✅ Sets up database schema with Drizzle
- ✅ Builds client (React/Vite) to `server/public/`
- ✅ Builds server (Node.js/Express) to `dist/index.js`
- ✅ Tests application startup
- ✅ Configures and starts PM2 process
- ✅ Updates Nginx configuration
- ✅ Sets up SSL (if domain resolves)
- ✅ Verifies deployment and external access
- ✅ Configures monitoring and logging

## Environment Configuration Details

During deployment, you'll be prompted for:

### Database Configuration
- **Database Host**: Usually `localhost` for local PostgreSQL
- **Database Port**: Default `5432`
- **Database Name**: e.g., `cricket_scorer`
- **Database Username**: e.g., `cricket_user`
- **Database Password**: Secure password for database access

### API Configuration
- **OpenAI API Key**: Your OpenAI API key (starts with `sk-`)
- **Session Secret**: Auto-generated secure random string

### Optional SSL Configuration
- **SSL Certificate Path**: Auto-configured with Let's Encrypt
- **SSL Private Key Path**: Auto-configured with Let's Encrypt

## File Structure After Deployment

```
/opt/cricket-scorer/
├── server/
│   ├── public/           # Built React app (served by Nginx)
│   │   ├── index.html
│   │   └── assets/
│   ├── index.ts         # Express server source
│   └── routes.ts        # API routes
├── client/              # React source code
├── shared/              # Shared types and schemas
├── dist/
│   └── index.js         # Built Express server (run by PM2)
├── logs/                # Application logs
├── backups/             # Automatic backups
├── .env                 # Environment variables (secure)
├── ecosystem.config.cjs # PM2 configuration
├── health-check.sh      # Health monitoring script
└── backup.sh           # Backup script
```

## Application URLs

After successful deployment:

- **HTTP**: http://score.ramisetty.net
- **HTTPS**: https://score.ramisetty.net (if SSL configured)
- **Health Check**: http://score.ramisetty.net/health
- **API Endpoints**: http://score.ramisetty.net/api/*

## Management Commands

### PM2 Process Management
```bash
# Check application status
pm2 status

# View logs
pm2 logs cricket-scorer

# Restart application
pm2 restart cricket-scorer

# Stop application
pm2 stop cricket-scorer

# Monitor in real-time
pm2 monit
```

### Nginx Management
```bash
# Check Nginx status
systemctl status nginx

# Reload Nginx configuration
systemctl reload nginx

# Test Nginx configuration
nginx -t

# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Database Management
```bash
# Connect to database (using DATABASE_URL from .env)
source /opt/cricket-scorer/.env
psql $DATABASE_URL

# View database connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### System Monitoring
```bash
# Run health check
/opt/cricket-scorer/health-check.sh

# Check system resources
htop
df -h
free -h

# View application logs
tail -f /opt/cricket-scorer/logs/*.log
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Not Starting
```bash
# Check PM2 logs
pm2 logs cricket-scorer

# Check if port 3000 is available
lsof -i :3000

# Restart application
pm2 restart cricket-scorer
```

#### 2. Static Files Not Loading (404 errors)
```bash
# Verify static files exist
ls -la /opt/cricket-scorer/server/public/

# Check Nginx configuration
nginx -t
tail -f /var/log/nginx/error.log

# Rebuild client if needed
cd /opt/cricket-scorer
npx vite build --outDir server/public --emptyOutDir
systemctl reload nginx
```

#### 3. Database Connection Issues
```bash
# Test database connection
source /opt/cricket-scorer/.env
psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL status
systemctl status postgresql-15

# View PostgreSQL logs
tail -f /var/lib/pgsql/15/data/log/postgresql-*.log
```

#### 4. SSL Certificate Issues
```bash
# Check certificate status
certbot certificates

# Renew certificate manually
certbot renew

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/score.ramisetty.net/cert.pem -text -noout | grep "Not After"
```

### Quick Recovery Commands

#### Rollback to Previous Deployment
```bash
# Find backup files
ls -la /opt/cricket-scorer/backups/

# Stop current application
pm2 stop cricket-scorer

# Restore from backup (replace with actual backup name)
cd /opt/cricket-scorer
tar -xzf backups/deployment_backup_YYYYMMDD_HHMMSS.tar.gz --strip-components=1

# Restart application
pm2 restart cricket-scorer
```

#### Rebuild and Restart
```bash
cd /opt/cricket-scorer

# Rebuild application
npx vite build --outDir server/public --emptyOutDir
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# Restart services
pm2 restart cricket-scorer
systemctl reload nginx
```

## Update Deployment

To deploy updates from GitHub:

```bash
# Simply run the deployment script again
./deploy-cricket-scorer.sh
```

The script will:
- Create a backup of current deployment
- Pull latest changes from GitHub
- Rebuild application
- Restart services
- Verify deployment

## Security Considerations

- ✅ Environment variables stored securely (600 permissions)
- ✅ Database password encrypted
- ✅ SSL/TLS encryption enabled
- ✅ Firewall configured with minimal open ports
- ✅ fail2ban protection against brute force attacks
- ✅ Regular security updates applied
- ✅ Application runs in process isolation (PM2)

## Backup and Recovery

### Automatic Backups
- Daily database backups at 2:00 AM
- Application backups before each deployment
- 7-day retention policy
- Backups stored in `/opt/cricket-scorer/backups/`

### Manual Backup
```bash
# Run backup script manually
/opt/cricket-scorer/backup.sh

# Create custom backup
tar -czf /opt/cricket-scorer/backups/manual_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='server/public' \
    /opt/cricket-scorer/
```

## Performance Monitoring

### Application Performance
- PM2 monitoring dashboard: `pm2 monit`
- Application logs: `/opt/cricket-scorer/logs/`
- Health check endpoint: `/health`

### System Performance
- Memory usage optimization
- PostgreSQL performance tuning
- Nginx caching and compression
- PM2 cluster mode for load distribution

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review application logs and performance
2. **Monthly**: Update system packages and security patches
3. **Quarterly**: Review and rotate secrets/certificates
4. **As Needed**: Update application from GitHub repository

### Log Locations
- Application logs: `/opt/cricket-scorer/logs/`
- PM2 logs: `pm2 logs cricket-scorer`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/lib/pgsql/15/data/log/`
- System logs: `/var/log/messages`

This comprehensive deployment system ensures a robust, secure, and maintainable production environment for the Cricket Scorer application.