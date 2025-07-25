#!/usr/bin/env node

/**
 * Test production API endpoints to diagnose server issues
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

async function testAPI() {
  console.log('=== Production API Diagnostic ===');
  
  loadEnvFile();
  
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  let pool;
  try {
    // Test database connection first
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();
    console.log('✓ Database connection successful');

    // Check if essential tables exist
    const tables = ['matches', 'teams', 'franchises'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✓ ${table} table: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`✗ ${table} table: ${error.message}`);
      }
    }

    // Test some basic queries that API endpoints would use
    console.log('\n--- Testing Core Queries ---');
    
    try {
      const matchesQuery = `
        SELECT m.id, m.title, m.status, 
               t1.name as team1_name, t2.name as team2_name
        FROM matches m
        LEFT JOIN teams t1 ON m.team1_id = t1.id
        LEFT JOIN teams t2 ON m.team2_id = t2.id
        LIMIT 5
      `;
      const matchesResult = await client.query(matchesQuery);
      console.log(`✓ Matches with teams query: ${matchesResult.rows.length} results`);
    } catch (error) {
      console.log(`✗ Matches query failed: ${error.message}`);
    }

    try {
      const franchisesQuery = `SELECT id, name, short_name FROM franchises LIMIT 5`;
      const franchisesResult = await client.query(franchisesQuery);
      console.log(`✓ Franchises query: ${franchisesResult.rows.length} results`);
    } catch (error) {
      console.log(`✗ Franchises query failed: ${error.message}`);
    }

    client.release();

    // Test HTTP endpoints if server is running
    console.log('\n--- Testing HTTP Endpoints ---');
    
    const endpoints = [
      'http://localhost:3000/api/matches',
      'http://localhost:3000/api/franchises',
      'http://localhost:3000/api/teams'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { 
          method: 'GET',
          timeout: 5000 
        });
        console.log(`✓ ${endpoint}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`  → Returned ${Array.isArray(data) ? data.length : 'non-array'} items`);
        }
      } catch (error) {
        console.log(`✗ ${endpoint}: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
          console.log('  → Server not running or not accessible on port 3000');
        }
      }
    }

  } catch (error) {
    console.error('✗ API test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Check:');
      console.error('1. PostgreSQL service: sudo systemctl status postgresql');
      console.error('2. Start if needed: sudo systemctl start postgresql');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testAPI().catch(console.error);