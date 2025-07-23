# Production Database Connection Commands

## Important: These commands are for the PRODUCTION SERVER (67.227.251.94)

**You need to SSH into your production server first:**
```bash
ssh root@67.227.251.94
```

## Then run these commands on the production server:

### 1. Reset Database Password (Run the script we created)
```bash
cd /opt/cricket-scorer  # or /root/cricket-scorer
./reset-database-password.sh
```

### 2. Manual Database Connection Commands

**Wrong commands (what you tried):**
```bash
psql -U cricket_scorer        # ❌ Wrong username
psql -U cricket_user          # ❌ Missing database name and host
```

**Correct commands:**
```bash
# Method 1: With password prompt
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer

# Method 2: Export password first
export PGPASSWORD=simple123
psql -h localhost -U cricket_user -d cricket_scorer

# Method 3: Connection string
psql "postgresql://cricket_user:simple123@localhost:5432/cricket_scorer"
```

## Summary of Correct Credentials:
- **Database Name**: cricket_scorer
- **Username**: cricket_user  
- **Password**: simple123
- **Host**: localhost (when on production server)
- **Port**: 5432

## Quick Production Fix:
```bash
# SSH to production server
ssh root@67.227.251.94

# Go to app directory
cd /opt/cricket-scorer || cd /root/cricket-scorer

# Run the password reset script
./reset-database-password.sh

# Test connection
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer

# If successful, restart the application
pm2 restart cricket-scorer

# Test the API
curl http://localhost:3000/api/teams
```

## Alternative: Deploy Script Method
If you want to redeploy everything fresh:
```bash
ssh root@67.227.251.94
cd /opt/cricket-scorer || cd /root/cricket-scorer
./deploy-cricket-scorer.sh
```

The deploy script now uses the correct `simple123` password and will set everything up properly.