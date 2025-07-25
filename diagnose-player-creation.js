#!/usr/bin/env node

/**
 * Diagnostic script to test player creation and identify production issues
 * Usage: node diagnose-player-creation.js
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

async function diagnosePlayerCreation() {
  console.log('=== Player Creation Diagnostic ===');
  
  loadEnvFile();
  
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  let pool;
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const client = await pool.connect();
    console.log('✓ Database connection successful');

    // Check players table structure
    console.log('\n--- Checking Players Table Structure ---');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position;
    `);

    if (tableStructure.rows.length === 0) {
      console.log('✗ Players table does not exist');
      client.release();
      process.exit(1);
    }

    console.log('Players table columns:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check for franchises table (foreign key dependency)
    console.log('\n--- Checking Franchises Table ---');
    const franchisesCheck = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'franchises';
    `);

    if (parseInt(franchisesCheck.rows[0].count) === 0) {
      console.log('✗ Franchises table does not exist - this may cause foreign key issues');
    } else {
      const franchisesCount = await client.query('SELECT COUNT(*) as count FROM franchises');
      console.log(`✓ Franchises table exists with ${franchisesCount.rows[0].count} records`);
    }

    // Test player creation with minimal data
    console.log('\n--- Testing Player Creation ---');
    try {
      const testPlayer = {
        name: 'Test Player Diagnostic',
        role: 'batsman',
        availability: true,
        is_active: true
      };

      console.log('Attempting to create test player...');
      
      // First, try to get a franchise ID if franchises exist
      let franchiseId = null;
      try {
        const franchiseResult = await client.query('SELECT id FROM franchises LIMIT 1');
        if (franchiseResult.rows.length > 0) {
          franchiseId = franchiseResult.rows[0].id;
          testPlayer.franchise_id = franchiseId;
          console.log(`Using franchise ID: ${franchiseId}`);
        }
      } catch (e) {
        console.log('No franchises available, creating player without franchise');
      }

      const insertQuery = `
        INSERT INTO players (name, role, availability, is_active, franchise_id, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
        RETURNING id, name, role;
      `;
      
      const result = await client.query(insertQuery, [
        testPlayer.name,
        testPlayer.role,
        testPlayer.availability,
        testPlayer.is_active,
        franchiseId
      ]);

      console.log('✓ Test player created successfully:');
      console.log(`  ID: ${result.rows[0].id}`);
      console.log(`  Name: ${result.rows[0].name}`);
      console.log(`  Role: ${result.rows[0].role}`);

      // Clean up test player
      await client.query('DELETE FROM players WHERE id = $1', [result.rows[0].id]);
      console.log('✓ Test player cleaned up');

    } catch (error) {
      console.log('✗ Player creation failed:');
      console.log(`  Error: ${error.message}`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Detail: ${error.detail || 'No additional details'}`);
      
      if (error.code === '23503') {
        console.log('  → This is a foreign key constraint violation');
        console.log('  → Check that referenced tables (franchises, teams, users) exist');
      } else if (error.code === '23502') {
        console.log('  → This is a NOT NULL constraint violation');
        console.log('  → Check that all required fields are provided');
      } else if (error.code === '42703') {
        console.log('  → This is a column does not exist error');
        console.log('  → Check schema normalization (camelCase vs snake_case)');
      }
    }

    client.release();
    console.log('\n✓ Diagnostic completed');

  } catch (error) {
    console.error('✗ Diagnostic failed:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

diagnosePlayerCreation().catch(console.error);