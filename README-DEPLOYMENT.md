# Cricket Scorer - Production Deployment Guide

This guide provides comprehensive instructions for deploying the Cricket Scorer application to a Linux production environment.

## Quick Start

### Production Deployment with PM2
```bash
# Make scripts executable
chmod +x deploy-pm2.sh

# Run production deployment with PM2
sudo ./deploy-pm2.sh
```

### Standard Deployment
```bash
# Make scripts executable
chmod +x deploy.sh update.sh monitoring.sh ssl-setup.sh

# Run deployment
sudo ./deploy.sh
```

## Prerequisites

- Linux server (Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+, or Fedora 35+)
- Minimum 1GB RAM, 2GB disk space
- Root access (sudo)
- Domain name (optional, for SSL)

## Supported Operating Systems

The deployment scripts automatically detect and support:
- **Ubuntu/Debian**: Uses `apt-get` package manager
- **CentOS/RHEL**: Uses `yum` package manager
- **Fedora**: Uses `dnf` package manager

## Deployment Scripts

### 1. `deploy-pm2.sh` - Production Deployment with PM2 (Recommended)

Complete production deployment script with PM2 process management:

**Usage:**
```bash
sudo ./deploy-pm2.sh
```

**What it does:**
1. Installs Node.js 20, PostgreSQL, Nginx
2. Installs PM2 process manager with log rotation
3. Creates application user and directories
4. Deploys and builds application
5. Configures PM2 ecosystem for clustering
6. Sets up Nginx reverse proxy (SSL-ready)
7. Configures firewall and security
8. Sets up automated backups
9. Optionally configures SSL with Let's Encrypt

**PM2 Benefits:**
- **Process clustering**: Runs multiple instances for better performance
- **Automatic restarts**: Application restarts on crashes
- **Memory monitoring**: Restarts on memory leaks
- **Log management**: Automated log rotation
- **Zero-downtime deployments**: Reload without stopping service

### 2. `deploy.sh` - Standard Deployment

Complete production deployment script that sets up:

- ✅ Node.js 20 runtime
- ✅ PostgreSQL database
- ✅ Nginx reverse proxy
- ✅ SSL-ready configuration
- ✅ Systemd service
- ✅ Firewall configuration
- ✅ Automated backups
- ✅ Security hardening

**Usage:**
```bash
sudo ./deploy.sh
```

**What it does:**
1. Updates system packages
2. Installs Node.js, PostgreSQL, Nginx
3. Creates application user and directories
4. Sets up database with secure credentials
5. Deploys and builds application
6. Configures systemd service (single process)
7. Sets up Nginx reverse proxy
8. Configures firewall (UFW)
9. Sets up fail2ban security
10. Creates automated backup system

### 3. `update.sh` - Application Updates

Safe update script that preserves data and configuration:

**Usage:**
```bash
sudo ./update.sh
```

**What it does:**
1. Creates backup before update
2. Stops application safely
3. Deploys new version
4. Preserves environment configuration
5. Runs database migrations
6. Restarts application

### 4. `monitoring.sh` - System Monitoring

Comprehensive monitoring and management script:

**Usage:**
```bash
# Health check
sudo ./monitoring.sh health

# System status
sudo ./monitoring.sh status

# View logs
sudo ./monitoring.sh logs

# Follow live logs
sudo ./monitoring.sh follow

# Restart application
sudo ./monitoring.sh restart

# Performance metrics
sudo ./monitoring.sh performance

# Setup automated monitoring
sudo ./monitoring.sh setup-monitoring
```

### 5. `ssl-setup.sh` - SSL/HTTPS Configuration

Automated SSL certificate setup using Let's Encrypt:

**Usage:**
```bash
sudo ./ssl-setup.sh
```

**Requirements:**
- Domain name pointing to your server
- Valid email address
- Ports 80 and 443 open

### 6. `fix-nodejs.sh` - Node.js Conflict Resolution

Fixes Node.js version conflicts on CentOS/RHEL/Fedora systems:

**Usage:**
```bash
sudo ./fix-nodejs.sh
```

**When to use:**
- When deployment fails with Node.js package conflicts
- When upgrading from older Node.js versions
- When multiple Node.js repositories conflict

## Post-Deployment Configuration

### 1. Environment Variables

Edit the environment file:
```bash
sudo nano /opt/cricket-scorer/current/.env
```

**Required updates:**
```env
# Update with your OpenAI API key
OPENAI_API_KEY=your_actual_api_key_here

# Update if using custom domain
APP_URL=https://your-domain.com
```

### 2. SSL Certificate (Optional)

If you have a domain name:
```bash
sudo ./ssl-setup.sh
```

This will:
- Configure Let's Encrypt SSL certificate
- Update Nginx for HTTPS
- Set up automatic renewal
- Enable HTTP to HTTPS redirect

### 3. Database Access

Database credentials are stored in:
- Database: `cricket_scorer`
- Username: `cricket_user` 
- Password: `cricket_secure_password_2025`
- Connection string in `/opt/cricket-scorer/current/.env`

## Application Management

### Service Control
```bash
# Start application
sudo systemctl start cricket-scorer

# Stop application
sudo systemctl stop cricket-scorer

# Restart application
sudo systemctl restart cricket-scorer

# Check status
sudo systemctl status cricket-scorer

# Enable auto-start on boot
sudo systemctl enable cricket-scorer
```

### Log Management
```bash
# View recent logs
sudo journalctl -u cricket-scorer -n 50

# Follow live logs
sudo journalctl -u cricket-scorer -f

# Application-specific logs
sudo tail -f /var/log/cricket-scorer/*.log
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql cricket_scorer

# Create backup
sudo /usr/local/bin/cricket-scorer-backup

# View backups
ls -la /opt/cricket-scorer-backups/
```

## Security Features

### Firewall Configuration
- SSH (22) - Allowed
- HTTP (80) - Allowed
- HTTPS (443) - Allowed
- All other ports - Blocked

### Fail2ban Protection
- Nginx rate limiting protection
- Automatic IP banning for suspicious activity
- 10-minute ban duration

### Application Security
- Non-root user execution
- Private temporary directories
- System protection enabled
- Security headers in Nginx

## Backup System

### Automated Backups
- Database backup: Daily at 2:00 AM
- Application backup: Daily at 2:00 AM
- Retention: 7 days
- Location: `/opt/cricket-scorer-backups/`

### Manual Backup
```bash
sudo /usr/local/bin/cricket-scorer-backup
```

### Restore from Backup
```bash
# Stop application
sudo systemctl stop cricket-scorer

# Restore database
sudo -u postgres psql cricket_scorer < /opt/cricket-scorer-backups/db-backup-YYYYMMDD-HHMMSS.sql

# Restore application (if needed)
cd /opt/cricket-scorer
sudo tar -xzf /opt/cricket-scorer-backups/app-backup-YYYYMMDD-HHMMSS.tar.gz

# Start application
sudo systemctl start cricket-scorer
```

## Performance Optimization

### System Resources
- Recommended: 2GB RAM, 4GB disk
- Minimum: 1GB RAM, 2GB disk
- CPU: 1 core minimum, 2+ cores recommended

### Database Tuning
PostgreSQL is configured with basic optimizations. For high-traffic deployments, consider:
- Increasing `shared_buffers`
- Tuning `work_mem`
- Optimizing `checkpoint_segments`

### Nginx Optimization
- Gzip compression enabled
- Static file caching (1 year)
- HTTP/2 support
- Security headers

## Troubleshooting

### Node.js Version Conflicts (CentOS/RHEL/Fedora)
If you encounter Node.js package conflicts during deployment:
```bash
# Run the Node.js conflict resolution script
sudo ./fix-nodejs.sh
```

This script will:
- Remove conflicting Node.js packages
- Clean package cache
- Install Node.js 20 with conflict resolution
- Restart the application service

### Application Won't Start
```bash
# Check service status
sudo systemctl status cricket-scorer

# Check logs
sudo journalctl -u cricket-scorer -n 50

# Check environment file
sudo cat /opt/cricket-scorer/current/.env

# Verify database connection
sudo -u postgres psql cricket_scorer -c "SELECT 1;"
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
sudo -u postgres psql -l

# Verify user permissions
sudo -u postgres psql -c "\du"
```

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Issues
```bash
# Monitor system resources
sudo ./monitoring.sh performance

# Check application logs
sudo ./monitoring.sh logs

# Monitor database performance
sudo -u postgres psql cricket_scorer -c "SELECT * FROM pg_stat_activity;"
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (nginx, HAProxy)
- Shared PostgreSQL database
- Session store in Redis
- Static file CDN

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Enable database connection pooling
- Implement caching layer

## Maintenance Tasks

### Weekly Tasks
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Check disk space
df -h

# Review logs for errors
sudo ./monitoring.sh logs | grep -i error
```

### Monthly Tasks
```bash
# Rotate log files
sudo logrotate -f /etc/logrotate.conf

# Review backup files
ls -la /opt/cricket-scorer-backups/

# Check SSL certificate expiry
sudo certbot certificates
```

## Support and Documentation

### Application Structure
```
/opt/cricket-scorer/
├── current/              # Current application
├── backups/             # Application backups
└── logs/                # Application logs

/etc/nginx/sites-available/cricket-scorer  # Nginx config
/etc/systemd/system/cricket-scorer.service # Service config
```

### Key Configuration Files
- Application: `/opt/cricket-scorer/current/.env`
- Nginx: `/etc/nginx/sites-available/cricket-scorer`
- Service: `/etc/systemd/system/cricket-scorer.service`
- Database: PostgreSQL standard locations

### Getting Help
1. Check logs: `sudo ./monitoring.sh logs`
2. Run health check: `sudo ./monitoring.sh health`
3. Review this documentation
4. Check application status: `sudo systemctl status cricket-scorer`

## Update History

- **v1.0** - Initial deployment scripts
- **v1.1** - Added SSL automation
- **v1.2** - Enhanced monitoring
- **v1.3** - Security hardening

---

**Note:** Always test deployment scripts in a staging environment before production use.