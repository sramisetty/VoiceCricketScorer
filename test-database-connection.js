#!/usr/bin/env node

/**
 * Simple database connection test for production deployment
 * This will help diagnose database connectivity issues
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    });
    
    console.log('✓ Loaded environment variables from .env file');
  } catch (error) {
    console.log('⚠ No .env file found or could not read it');
  }
}

async function testDatabaseConnection() {
  console.log('=== Database Connection Test ===');
  
  // Load environment variables first
  loadEnvFile();
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL environment variable is not set');
    console.error('Please ensure DATABASE_URL is configured in your environment');
    process.exit(1);
  }
  
  console.log(`Database URL: ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@')}`);
  
  let pool;
  try {
    // Create connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false, // Local database without SSL
      connectionTimeoutMillis: 10000, // 10 second timeout
    });
    
    console.log('Attempting to connect to database...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log(`✓ Database query successful`);
    console.log(`  Current time: ${result.rows[0].current_time}`);
    console.log(`  PostgreSQL version: ${result.rows[0].postgres_version.split(' ')[0]}`);
    
    // Test if Score Pro tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'franchises', 'teams', 'players', 'matches')
      ORDER BY table_name
    `);
    
    console.log(`✓ Found ${tablesResult.rows.length} Score Pro tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    if (tablesResult.rows.length === 0) {
      console.log('⚠ No Score Pro tables found. You may need to run database migrations.');
      console.log('  Run: npm run db:push');
    }
    
    // Test user count
    try {
      const userCountResult = await client.query('SELECT COUNT(*) as user_count FROM users');
      const userCount = parseInt(userCountResult.rows[0].user_count);
      console.log(`✓ Found ${userCount} users in database`);
      
      if (userCount === 0) {
        console.log('⚠ No users found. You may need to create an admin user.');
        console.log('  Run: ./create-admin.sh');
      } else {
        // Check for admin users
        const adminResult = await client.query(
          "SELECT COUNT(*) as admin_count FROM users WHERE role IN ('admin', 'global_admin')"
        );
        const adminCount = parseInt(adminResult.rows[0].admin_count);
        console.log(`✓ Found ${adminCount} admin users`);
        
        if (adminCount === 0) {
          console.log('⚠ No admin users found. You may need to create an admin user.');
          console.log('  Run: ./create-admin.sh');
        }
      }
    } catch (error) {
      console.log('⚠ Could not check user count (table might not exist)');
    }
    
    client.release();
    console.log('\n✓ All database tests passed!');
    
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nTroubleshooting steps:');
      console.error('1. Check if PostgreSQL service is running:');
      console.error('   sudo systemctl status postgresql');
      console.error('2. Start PostgreSQL if needed:');
      console.error('   sudo systemctl start postgresql');
      console.error('3. Check PostgreSQL configuration:');
      console.error('   sudo -u postgres psql -c "\\l"');
    } else if (error.code === '28P01') {
      console.error('\nAuthentication failed. Check:');
      console.error('1. Database username and password in DATABASE_URL');
      console.error('2. PostgreSQL user exists and has proper permissions');
      console.error('3. pg_hba.conf authentication settings');
    } else if (error.code === '3D000') {
      console.error('\nDatabase does not exist. Create it with:');
      console.error('sudo -u postgres createdb cricket_scorer');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\nDatabase test cancelled by user');
  process.exit(0);
});

testDatabaseConnection().catch(console.error);