# Fresh Production Deployment Guide

## Current Status
- ✅ Drizzle config is up-to-date with snake_case schema
- ✅ Local development environment working
- ❌ Production database has old camelCase column names causing conflicts

## Solution: Fresh Deployment with Master Script

### Step 1: Run Master Deployment Script
```bash
ssh root@67.227.251.94
cd /opt/cricket-scorer
./deploy-cricket-scorer.sh
```

### What the Master Script Will Do:
1. **Pull latest code** from repository
2. **Rebuild application** with current schema
3. **Run database migrations** (`npm run db:push`) to sync schema
4. **Restart all services** (PM2, nginx)
5. **Test application** endpoints
6. **Verify functionality** end-to-end

### Expected Results:
- ✅ Database schema updated to snake_case (`short_name`, `team_id`)
- ✅ Application code matches database structure
- ✅ Team creation and fetching work correctly
- ✅ https://score.ramisetty.net fully functional

### Why This Approach is Better:
- **No emergency patches** - clean, documented process
- **Uses proven deployment pipeline** that worked before
- **Maintains all existing configurations** (environment variables, SSL, etc.)
- **Comprehensive testing** built into the script
- **Rollback capability** if issues occur

### Post-Deployment Verification:
```bash
# Test teams API
curl https://score.ramisetty.net/api/teams

# Test team creation
curl -X POST https://score.ramisetty.net/api/teams \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Team","shortName":"TST"}'
```

This is the proper, maintainable solution instead of using emergency fix scripts.