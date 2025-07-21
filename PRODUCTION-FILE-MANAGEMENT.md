# Production File Management - What to Preserve vs Replace

## Cricket Scorer Production Deployment File Handling

### ✅ PRESERVE - Never Overwrite (Critical Data/Config)

#### Database & Environment Files
- **`.env`** - Production environment variables (DB credentials, API keys, secrets)
- **`.env.production`** - Production-specific environment configuration
- **`ecosystem.config.cjs`** - PM2 configuration (if customized for production)

#### Database Data
- **PostgreSQL database** - All user data, matches, teams, players
- **Database backups** - Any backup files in production

#### SSL & Security
- **`/etc/letsencrypt/`** - SSL certificates (handled by nginx setup)
- **`/etc/nginx/nginx.conf`** - Working nginx configuration
- **Firewall settings** - iptables/ufw configurations

#### Log Files
- **PM2 logs** - Application logs and error history
- **Nginx logs** - Access and error logs
- **System logs** - Any production monitoring logs

### 🔄 SAFE TO REPLACE - Application Code

#### Source Code
- **`client/`** - React frontend application
- **`server/`** - Express backend application  
- **`shared/`** - Shared TypeScript schemas
- **`package.json`** - Dependencies (will be updated)
- **`package-lock.json`** - Lock file (regenerated)

#### Build Outputs
- **`dist/`** - Compiled application (regenerated)
- **`node_modules/`** - Dependencies (reinstalled)
- **`server/public/`** - Static assets (rebuilt)

#### Configuration Templates
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.ts`** - Tailwind configuration
- **`vite.config.ts`** - Development Vite config
- **`vite.config.production.ts`** - Production build config
- **`drizzle.config.ts`** - Database ORM config

### ⚠️ HANDLE WITH CARE - Check Before Overwriting

#### PM2 Configuration
- **`ecosystem.config.cjs`** - Check if production has customizations
- If customized, merge changes instead of replacing

#### Environment Files
- **`.env`** - Backup existing, merge with new template
- Production may have additional environment variables

## Deployment Script Best Practices

### Current deploy-cricket-scorer.sh Approach
```bash
# 1. Backup critical files
cp .env .env.backup 2>/dev/null || true
cp ecosystem.config.cjs ecosystem.config.cjs.backup 2>/dev/null || true

# 2. Pull/clone fresh code
git clone/pull repository

# 3. Restore critical files
cp .env.backup .env 2>/dev/null || true
# Use backup ecosystem.config.cjs if it has production customizations

# 4. Install/build new code
npm install
npm run build:production

# 5. Restart services with preserved config
pm2 restart cricket-scorer
```

### Recommended File Backup Strategy
```bash
# Before deployment, backup critical files
BACKUP_DIR="/opt/cricket-scorer-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup environment and config
cp .env $BACKUP_DIR/ 2>/dev/null || true
cp .env.production $BACKUP_DIR/ 2>/dev/null || true
cp ecosystem.config.cjs $BACKUP_DIR/ 2>/dev/null || true

# Backup database (if needed)
pg_dump cricket_scorer > $BACKUP_DIR/database.sql 2>/dev/null || true
```

## Database Migration Handling

### Safe Database Updates
- **Schema migrations** - Always run via `npm run db:push`
- **Data preservation** - Never DROP tables with user data
- **Backup before migration** - Always backup before schema changes

### Migration Commands in deploy-cricket-scorer.sh
```bash
# Safe database migration approach
echo "Running database migrations..."
npm run db:push

# Verify migration success
if ! npm run db:push --dry-run; then
    echo "⚠️ Migration would fail - manual review needed"
    exit 1
fi
```

## Directory Structure Preservation

### Production Directory Layout
```
/opt/cricket-scorer/
├── .env                     # 🔒 PRESERVE - Production secrets
├── .env.production         # 🔒 PRESERVE - Environment config  
├── ecosystem.config.cjs    # ⚠️ CHECK - May have customizations
├── client/                 # 🔄 REPLACE - Source code
├── server/                 # 🔄 REPLACE - Source code
├── shared/                 # 🔄 REPLACE - Source code
├── dist/                   # 🔄 REPLACE - Build output
├── node_modules/           # 🔄 REPLACE - Dependencies
├── package.json           # 🔄 REPLACE - Will be updated
└── logs/                  # 🔒 PRESERVE - Application logs
```

## Key Principles

1. **Never lose environment variables** - Always backup .env files
2. **Preserve database integrity** - Never overwrite database files
3. **Maintain SSL certificates** - Don't touch /etc/letsencrypt/
4. **Keep working nginx config** - Only update if deployment fixes it
5. **Backup before changes** - Create timestamped backups
6. **Test after deployment** - Verify application works before completing

## Emergency Recovery

If deployment overwrites critical files:
```bash
# Restore from backup
cp /opt/cricket-scorer-backup-*/.*env /opt/cricket-scorer/
cp /opt/cricket-scorer-backup-*/ecosystem.config.cjs /opt/cricket-scorer/

# Restart services
pm2 restart cricket-scorer
systemctl restart nginx
```

This ensures production deployments update code while preserving all critical data and configuration.