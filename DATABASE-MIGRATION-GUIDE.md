# Cricket Scorer Database Migration System

## Overview

The Cricket Scorer application now uses a dedicated database migration system that provides better control, versioning, and reliability for production database deployments. This system replaces the previous inline SQL approach with dedicated migration files and runners.

## Migration Architecture

### 1. Core Migration Files

- **`migrations/production-schema.sql`** - Complete database schema with all tables, columns, and data
- **`migrations/run-migration.sh`** - Migration runner script with validation and safety checks
- **`deploy-cricket-scorer.sh`** - Updated deployment script that uses the new migration system

### 2. Key Benefits

- **Version Control**: Database changes are tracked in dedicated SQL files
- **Safety First**: All changes use `IF NOT EXISTS` patterns to prevent data loss
- **Automatic Backup**: Creates schema backups before applying changes
- **Validation**: Comprehensive pre and post-migration validation
- **Rollback Support**: Schema backups allow manual rollback if needed
- **Production Ready**: Designed for safe production deployments

## Migration System Components

### Production Schema (`migrations/production-schema.sql`)

**Features:**
- **Complete Schema Creation**: All 12 tables with comprehensive column definitions
- **ICC Cricket Compliance**: Full cricket rule fields (penalties, dismissals, etc.)
- **Safety Patterns**: All tables and columns use `IF NOT EXISTS` checks
- **Data Initialization**: Default admin user and sample franchises
- **Performance Indexes**: Optimized database indexes for query performance
- **Comprehensive Coverage**: 250+ individual column validations

**Tables Included:**
1. `sessions` - User session storage (Replit Auth required)
2. `users` - User authentication and roles
3. `franchises` - Cricket franchise management
4. `teams` - Team information and associations
5. `players` - Player profiles and statistics
6. `user_player_links` - User-player associations
7. `player_franchise_links` - Player-franchise relationships
8. `matches` - Match setup and management
9. `innings` - Innings tracking and statistics
10. `balls` - Ball-by-ball cricket data
11. `player_stats` - Comprehensive player statistics
12. `match_player_selections` - Team selection for matches

### Migration Runner (`migrations/run-migration.sh`)

**Features:**
- **Environment Configuration**: Supports custom database credentials
- **Prerequisite Validation**: Checks psql availability and database connectivity
- **Automatic Database Creation**: Creates database if it doesn't exist
- **Schema Backup**: Backs up existing schema before migration
- **Migration Execution**: Safely applies migration with error handling
- **Post-Migration Validation**: Verifies all tables and data are created correctly
- **Comprehensive Logging**: Color-coded output with timestamps

**Usage:**
```bash
# Basic usage (uses default credentials)
./migrations/run-migration.sh

# Custom database configuration
DB_HOST=production-server DB_USER=cricket_admin DB_PASSWORD=secure123 ./migrations/run-migration.sh
```

## Deployment Integration

### Updated Deployment Process

The `deploy-cricket-scorer.sh` script now integrates with the migration system:

1. **Database User Setup**: Creates PostgreSQL user if needed
2. **Migration Execution**: Calls `migrations/run-migration.sh`
3. **Validation**: Confirms successful migration completion
4. **Application Build**: Continues with standard build process

### Environment Variables

The migration system uses these environment variables:

```bash
DB_HOST=localhost        # PostgreSQL server hostname
DB_USER=cricket_user     # Database username  
DB_PASSWORD=simple123    # Database password
DB_NAME=cricket_scorer   # Database name
```

## Development Workflow

### Adding New Schema Changes

1. **Update Schema File**: Modify `migrations/production-schema.sql`
   ```sql
   -- Add new column with IF NOT EXISTS safety
   DO $$ 
   BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'players' AND column_name = 'new_field') THEN
           ALTER TABLE players ADD COLUMN new_field VARCHAR;
       END IF;
   END $$;
   ```

2. **Test Locally**: Run migration on development database
   ```bash
   ./migrations/run-migration.sh
   ```

3. **Update Drizzle Schema**: Sync `shared/schema.ts` with SQL changes

4. **Deploy to Production**: Run deployment script
   ```bash
   ./deploy-cricket-scorer.sh
   ```

### Schema Change Best Practices

- **Always use IF NOT EXISTS patterns** for tables and columns
- **Provide default values** for new columns to handle existing data
- **Test migrations thoroughly** on development environment first
- **Document breaking changes** in migration comments
- **Version your migrations** with timestamps and descriptions

## Production Database Access

### Default Credentials

- **Database**: cricket_scorer
- **Username**: cricket_user
- **Password**: simple123
- **Host**: localhost

### Admin Account

The migration automatically creates a default admin account:
- **Email**: admin@cricket.com
- **Password**: admin123
- **Role**: global_admin

### Sample Data

The migration includes sample franchise data:
- Mumbai Warriors (MW)
- Chennai Champions (CC)
- Delhi Dynamos (DD)
- Kolkata Knights (KK)

## Migration Safety Features

### Data Protection

- **IF NOT EXISTS Checks**: Prevents table recreation and data loss
- **Conflict Resolution**: Uses `ON CONFLICT DO NOTHING` for data inserts
- **Schema Backup**: Automatic backup before migration execution
- **Validation**: Post-migration checks ensure data integrity

### Error Handling

- **Connection Testing**: Validates database connectivity before migration
- **Migration Rollback**: Schema backups enable manual rollback
- **Detailed Logging**: Comprehensive error messages and debugging output
- **Exit on Failure**: Stops deployment on migration errors

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```bash
   # Check PostgreSQL service
   systemctl status postgresql
   
   # Verify user credentials
   psql -h localhost -U cricket_user -d postgres
   ```

2. **Migration Permission Errors**
   ```bash
   # Ensure user has proper permissions
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON SCHEMA public TO cricket_user;"
   ```

3. **Missing Migration File**
   ```bash
   # Verify file exists and is executable
   ls -la migrations/
   chmod +x migrations/run-migration.sh
   ```

### Debug Mode

Run migration with verbose output:
```bash
# Enable PostgreSQL query logging
PGPASSWORD=simple123 psql -h localhost -U cricket_user -d cricket_scorer -f migrations/production-schema.sql
```

## Migration History

- **Version 2025.01.25**: Initial migration system implementation
  - Complete schema with 12 tables
  - ICC cricket rule compliance
  - Safety patterns and validation
  - Admin user and sample data initialization

## Future Enhancements

- **Migration Versioning**: Sequential migration files (001_initial.sql, 002_add_stats.sql)
- **Automated Testing**: Unit tests for migration validation
- **Schema Comparison**: Tools to compare development vs production schemas
- **Migration Rollback**: Automated rollback capabilities
- **Change Tracking**: Database change logs and audit trails