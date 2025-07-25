# Development Workflow for Schema Changes
## Step-by-Step Process to Prevent Schema Issues

### ⚡ Quick Reference Commands
```bash
# AUTOMATED: Prepare deployment script (all 4 steps)  
./prepare-deployment.sh

# OR MANUAL APPROACH:
# 1. Validate schema before deployment
./validate-schema.sh

# 2. Test schema locally
npm run db:push

# 3. Deploy to production (only after validation passes)
./deploy-cricket-scorer.sh
```

### 🤖 AUTOMATED WORKFLOW (RECOMMENDED)
When you need to prepare deploy-cricket-scorer.sh for production:

```bash
# Single command automates all 4 steps:
./prepare-deployment.sh
```

This automatically:
- ✅ Analyzes shared/schema.ts for all tables and columns
- ✅ Generates production-safe SQL with IF NOT EXISTS patterns  
- ✅ Updates deploy-cricket-scorer.sh with new schema
- ✅ Validates the final result

Then simply deploy:
```bash
./deploy-cricket-scorer.sh
```

## Complete Development Workflow

### Phase 1: Schema Design
1. **Update shared/schema.ts FIRST**
   - Add new tables or columns to the TypeScript schema
   - Define proper types, constraints, and defaults
   - This is your single source of truth

### Phase 2: Local Testing
2. **Sync local database**
   ```bash
   npm run db:push
   ```
   - Tests your schema changes locally
   - Catches TypeScript/SQL conflicts early

3. **Update storage layer** (if needed)
   - Modify server/storage.ts for new fields
   - Update API routes in server/routes.ts
   - Test application functionality

### Phase 3: Production Preparation
4. **Update deployment script**
   - Add CREATE TABLE IF NOT EXISTS for new tables
   - Add IF NOT EXISTS column checks for new columns
   - Update table count verification if new tables added

5. **Validate schema sync**
   ```bash
   ./validate-schema.sh
   ```
   - Automated check that deployment script matches schema.ts
   - Must pass before production deployment

### Phase 4: Deployment
6. **Deploy to production**
   ```bash
   ./deploy-cricket-scorer.sh
   ```
   - Only deploy after validation passes
   - Script handles all schema changes safely

## Schema Change Examples

### Adding a New Table
1. **shared/schema.ts**:
   ```typescript
   export const notifications = pgTable("notifications", {
     id: serial("id").primaryKey(),
     user_id: integer("user_id").references(() => users.id).notNull(),
     message: text("message").notNull(),
     is_read: boolean("is_read").default(false),
     created_at: timestamp("created_at").defaultNow(),
   });
   ```

2. **deploy-cricket-scorer.sh**:
   ```sql
   -- Create notifications table if it doesn't exist
   CREATE TABLE IF NOT EXISTS notifications (
       id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES users(id) NOT NULL,
       message TEXT NOT NULL,
       is_read BOOLEAN DEFAULT false,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Add missing columns to notifications if they don't exist
   DO $$ 
   BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
           ALTER TABLE notifications ADD COLUMN user_id INTEGER REFERENCES users(id) NOT NULL;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') THEN
           ALTER TABLE notifications ADD COLUMN message TEXT NOT NULL;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_read') THEN
           ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='created_at') THEN
           ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
       END IF;
   END $$;
   ```

3. **Update table count**: Change from 12 to 13 in verification section

### Adding a New Column
1. **shared/schema.ts**:
   ```typescript
   export const users = pgTable("users", {
     // ... existing columns
     phone_number: text("phone_number"), // NEW COLUMN
   });
   ```

2. **deploy-cricket-scorer.sh**:
   ```sql
   -- Add to existing users column checks
   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone_number') THEN
       ALTER TABLE users ADD COLUMN phone_number TEXT;
   END IF;
   ```

## Prevention Checklist

### Before Making Changes:
- [ ] Read SCHEMA-DEVELOPMENT-STRATEGY.md
- [ ] Understand the current schema structure
- [ ] Plan changes to avoid breaking existing data

### During Development:
- [ ] Update shared/schema.ts first
- [ ] Test locally with npm run db:push
- [ ] Update storage layer if needed
- [ ] Update deploy-cricket-scorer.sh with IF NOT EXISTS patterns

### Before Deployment:
- [ ] Run ./validate-schema.sh (must pass)
- [ ] All schema changes documented in replit.md
- [ ] No manual database modifications planned
- [ ] Default values are production-safe

### After Deployment:
- [ ] Verify deployment success messages
- [ ] Test application functionality
- [ ] Update documentation if major changes

## Emergency Recovery
If schema issues occur:
1. Check error logs for missing columns/tables
2. Update shared/schema.ts to match production
3. Add missing IF NOT EXISTS checks to deploy-cricket-scorer.sh
4. Run ./validate-schema.sh to verify
5. Deploy again with fixed script

## Success Indicators
- ✅ ./validate-schema.sh passes
- ✅ npm run db:push works locally
- ✅ No schema deployment errors
- ✅ Application functions normally after deployment

This workflow ensures zero schema issues and smooth development-to-production transitions.