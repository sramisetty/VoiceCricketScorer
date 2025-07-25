#!/usr/bin/env node

/**
 * Quick CommonJS database test for production servers
 * This avoids ES module issues and provides immediate diagnostics
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
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

async function quickDatabaseTest() {
  console.log('=== Quick Database Test ===');
  
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
      connectionTimeoutMillis: 5000, // 5 second timeout
    });
    
    console.log('Testing database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✓ Database query successful at ${result.rows[0].current_time}`);
    
    // Test if Score Pro tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'franchises', 'teams', 'players', 'matches')
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log(`✓ Found ${tablesResult.rows.length} Score Pro tables`);
      
      // Count users
      try {
        const userCountResult = await client.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(userCountResult.rows[0].count);
        console.log(`✓ Found ${userCount} users in database`);
        
        if (userCount === 0) {
          console.log('⚠ No users found. Create admin with: ./create-admin.sh');
        } else {
          const adminResult = await client.query(
            "SELECT COUNT(*) as count FROM users WHERE role IN ('admin', 'global_admin')"
          );
          const adminCount = parseInt(adminResult.rows[0].count);
          console.log(`✓ Found ${adminCount} admin users`);
        }
      } catch (error) {
        console.log('⚠ Could not count users (table structure may need updating)');
      }
    } else {
      console.log('⚠ No Score Pro tables found. Run: npm run db:push');
    }
    
    client.release();
    console.log('\n✓ Database test completed successfully!');
    
  } catch (error) {
    console.error('✗ Database test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Check:');
      console.error('1. PostgreSQL service: sudo systemctl status postgresql');
      console.error('2. Start if needed: sudo systemctl start postgresql');
    } else if (error.code === '28P01') {
      console.error('\nAuthentication failed. Check DATABASE_URL credentials');
    } else if (error.code === '3D000') {
      console.error('\nDatabase does not exist. Create with:');
      console.error('sudo -u postgres createdb cricket_scorer');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

quickDatabaseTest().catch(console.error);