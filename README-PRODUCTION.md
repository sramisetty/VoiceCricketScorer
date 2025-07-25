# Score Pro Production Scripts Guide

## Core Production Scripts

After cleanup, these are the essential scripts for managing your Score Pro production deployment:

### 🚀 Main Management Scripts

**`./setup-admin-user.sh`** - Comprehensive admin user management
- Interactive creation of new admin users
- Fix/update passwords for existing users
- Automatic environment loading and database testing
- Guided prompts with validation

**`./check-production-status.sh`** - Application health monitoring
- Tests all services (PostgreSQL, Nginx, PM2)
- Checks API endpoints and database connectivity
- Validates environment variables
- Provides next steps and troubleshooting guidance

**`./fix-database-connection.sh`** - Database troubleshooting
- Loads environment variables properly
- Tests database connectivity
- Runs migrations if needed
- Restarts application after fixes

### 🔧 Database Utilities

**`node quick-database-test.cjs`** - Fast database connectivity test
- Loads .env file automatically
- Tests connection and basic queries
- Shows table counts and admin user status
- CommonJS format (no ES module issues)

**`node create-admin-user.js`** - Direct admin user creation
- Command line: `node create-admin-user.js email password firstname lastname`
- Proper bcrypt password hashing with verification
- Automatic environment loading

**`node fix-user-password.js`** - Password fixing utility
- Command line: `node fix-user-password.js email new_password`
- Updates existing user passwords with proper hashing
- Detects and fixes plain text passwords

### 🛠 Deployment Scripts

**`./deploy-cricket-scorer.sh`** - Main deployment script
- Full application deployment from GitHub
- Builds client and server
- Manages PM2 process
- Preserves production files

**`./setup-almalinux-production.sh`** - Initial server setup
- Installs Node.js, PostgreSQL, Nginx
- Configures SSL certificates
- Security hardening
- One-time server preparation

**`./setup-production-env.sh`** - Environment configuration
- Interactive environment variable setup
- Secure password generation
- Creates .env file with all required variables

## Quick Start Commands

### First Time Setup
```bash
# 1. Set up the server (one time only)
./setup-almalinux-production.sh

# 2. Configure environment variables (one time only)
./setup-production-env.sh

# 3. Deploy the application
./deploy-cricket-scorer.sh

# 4. Create admin user
./setup-admin-user.sh
```

### Daily Operations
```bash
# Check application health
./check-production-status.sh

# Create/manage admin users
./setup-admin-user.sh

# Test database connection
node quick-database-test.cjs

# View application logs
pm2 logs cricket-scorer

# Restart application
pm2 restart cricket-scorer
```

### Troubleshooting
```bash
# Fix database issues
./fix-database-connection.sh

# Fix user password
node fix-user-password.js user@example.com newpassword123

# Redeploy application
./deploy-cricket-scorer.sh

# Check detailed status
./check-production-status.sh
```

## File Structure

### Keep These Files (Core Production Scripts)
- `setup-admin-user.sh` - Main admin management
- `check-production-status.sh` - Health monitoring
- `fix-database-connection.sh` - Database troubleshooting
- `create-admin-user.js` - Admin creation utility
- `fix-user-password.js` - Password management
- `quick-database-test.cjs` - Database testing
- `deploy-cricket-scorer.sh` - Application deployment
- `setup-almalinux-production.sh` - Server setup
- `setup-production-env.sh` - Environment configuration

### Cleanup Completed
The following temporary/redundant files have been removed:
- `create-admin.sh` - Replaced by `setup-admin-user.sh`
- `load-env-and-test.sh` - Integrated into other scripts
- `test-database-connection.js` - Replaced by `quick-database-test.cjs`

## Environment Variables

Your `.env` file should contain:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://cricket_user:simple123@localhost:5432/cricket_scorer?sslmode=disable
OPENAI_API_KEY=your_openai_key_here
SESSION_SECRET=your_session_secret_here
```

## Support

- **Application URL**: https://score.ramisetty.net
- **Admin Login**: Use credentials created with `./setup-admin-user.sh`
- **Logs**: `pm2 logs cricket-scorer`
- **Status**: `./check-production-status.sh`

All scripts include comprehensive error handling and troubleshooting guidance.