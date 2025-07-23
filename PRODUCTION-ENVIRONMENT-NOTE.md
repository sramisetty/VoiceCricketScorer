# Important: Production vs Development Environment

## Current Issue Resolution

You are currently trying to run production database fixes from the **development environment** (Replit), but the database issues are on your **production server** (67.227.251.94).

### Environment Identification:
- **Development (Replit)**: Uses Nix package manager, no systemctl, different PostgreSQL paths
- **Production (67.227.251.94)**: AlmaLinux 9, systemctl, standard PostgreSQL installation

### Correct Process:

1. **SSH to Production Server:**
   ```bash
   ssh root@67.227.251.94
   ```

2. **Navigate to Application Directory:**
   ```bash
   cd /opt/cricket-scorer || cd /root/cricket-scorer
   ```

3. **Run Database Fix Scripts:**
   ```bash
   # Try the enhanced reset script first
   ./reset-database-password.sh
   
   # If that fails, use emergency fix
   ./emergency-database-fix.sh
   ```

4. **Test Connection on Production:**
   ```bash
   PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer
   ```

5. **Test Application API:**
   ```bash
   curl http://localhost:3000/api/teams
   ```

### Scripts Updated:
- **emergency-database-fix.sh**: Now detects environment and shows proper instructions
- **reset-database-password.sh**: Enhanced with better PostgreSQL path detection
- **deploy-cricket-scorer.sh**: Uses correct database credentials throughout

### Expected Result:
After running the scripts on the production server, your Cricket Scorer application should be able to create matches without the "Failed to create teams add players" error.

### Status Check:
Once fixed, verify with:
```bash
# On production server
curl http://localhost:3000/api/teams
curl https://score.ramisetty.net/
```

The development environment (Replit) works fine - the issue is specifically with the production database connection on AlmaLinux 9.