# Cricket Scorer Deployment Script Execution Order

## Overview
This document outlines the correct order of script execution for deploying the Cricket Scorer application on AlmaLinux 9 production servers.

## Script Execution Sequence

### 1. Initial Server Setup (One-time only)
```bash
sudo ./setup-almalinux-production.sh
```
**Purpose:** Complete server infrastructure setup
**What it does:**
- Installs Node.js 20.x, PostgreSQL 15, Nginx
- Configures security (firewall, fail2ban)
- Sets up SSL with Let's Encrypt
- Creates system users and directories
- Configures backup systems

### 2. Environment Configuration (One-time only)
```bash
sudo ./setup-production-env.sh
```
**Purpose:** Interactive environment variable setup
**What it does:**
- Prompts for database credentials
- Sets up OPENAI_API_KEY
- Generates session secrets
- Creates .env.production file
- Configures PM2 environment

### 3. Main Application Deployment (Run for updates)
```bash
sudo ./deploy-cricket-scorer.sh
```
**Purpose:** End-to-end application deployment
**What it does:**
- Clones/updates from GitHub repository
- Builds client and server applications
- Configures database and runs migrations
- Sets up PM2 process management
- Configures nginx with minimal proxy setup
- Verifies deployment success

### 4. Emergency Recovery (If needed)
```bash
sudo ./emergency-services-fix.sh
```
**Purpose:** Quick recovery from service failures
**What it does:**
- Restores minimal nginx configuration
- Restarts PM2 application
- Provides immediate service recovery

### 5. Status Checking (Any time)
```bash
sudo ./check-production-status.sh
```
**Purpose:** Verify system status and troubleshoot
**What it does:**
- Checks PM2 application status
- Verifies port 3000 accessibility
- Tests nginx proxy functionality
- Provides troubleshooting information

## Typical Deployment Workflow

### First-Time Server Setup
1. `setup-almalinux-production.sh` (server infrastructure)
2. `setup-production-env.sh` (environment configuration)
3. `deploy-cricket-scorer.sh` (application deployment)

### Regular Updates
1. `deploy-cricket-scorer.sh` (updates application code)

### Emergency Recovery
1. `emergency-services-fix.sh` (if services break)
2. `check-production-status.sh` (verify recovery)

## Script Dependencies

```
setup-almalinux-production.sh
├── Installs: Node.js, PostgreSQL, Nginx, PM2
├── Configures: Security, SSL, Monitoring
└── Creates: System users, directories

setup-production-env.sh
├── Requires: Node.js, PostgreSQL (from step 1)
├── Creates: .env.production
└── Configures: Environment variables

deploy-cricket-scorer.sh
├── Requires: All infrastructure (steps 1-2)
├── Uses: .env.production
├── Builds: Client/server applications
├── Configures: Database, PM2, Nginx
└── Starts: All services

emergency-services-fix.sh
├── Requires: Basic infrastructure
├── Fixes: Nginx configuration
└── Restarts: PM2 services

check-production-status.sh
├── Requires: Deployed application
└── Provides: Status and diagnostics
```

## Important Notes

### Golden Rule
- **NEVER modify:** `setup-almalinux-production.sh` or `setup-production-env.sh`
- These are "golden" files that work reliably

### Script Consolidation
- All deployment fixes are consolidated into `deploy-cricket-scorer.sh`
- No separate patch scripts should be created
- Emergency recovery is handled by `emergency-services-fix.sh`

### Environment Requirements
- Scripts must be run as root (`sudo`)
- Server must have internet access for package installation
- Domain DNS must point to server IP (67.227.251.94)

### Troubleshooting Order
1. Check application: `curl localhost:3000`
2. Check nginx proxy: `curl localhost`
3. Run status check: `./check-production-status.sh`
4. If broken, run: `./emergency-services-fix.sh`
5. If still issues, re-run: `./deploy-cricket-scorer.sh`

## Success Indicators
- ✓ Application responds on `localhost:3000`
- ✓ Nginx proxy works on `localhost:80`
- ✓ Website accessible at `https://score.ramisetty.net`
- ✓ PM2 shows "online" status for cricket-scorer
- ✓ PostgreSQL service running
- ✓ Nginx service running

This order ensures reliable, repeatable deployments with proper error recovery mechanisms.