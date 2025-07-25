#!/usr/bin/env node

/**
 * Script to fix/update user password with proper hashing
 * Usage: node fix-user-password.js <email> <new_password>
 * Example: node fix-user-password.js admin@example.com newpassword123
 */

import bcrypt from 'bcryptjs';
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

async function fixUserPassword() {
  // Load environment variables first
  loadEnvFile();

  console.log('=== Fix User Password ===');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL environment variable is not set');
    console.error('Please ensure DATABASE_URL is configured in your environment');
    process.exit(1);
  }
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node fix-user-password.js <email> <new_password>');
    console.error('Example: node fix-user-password.js admin@example.com newpassword123');
    process.exit(1);
  }
  
  const [email, newPassword] = args;
  
  // Validate inputs
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Error: Invalid email format');
    process.exit(1);
  }
  
  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters long');
    process.exit(1);
  }
  
  console.log(`Email: ${email}`);
  console.log(`New password length: ${newPassword.length} characters`);
  
  try {
    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    });
    
    console.log('✓ Connected to database');
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, email, role, password_hash FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length === 0) {
      console.error(`✗ User with email ${email} not found`);
      await pool.end();
      process.exit(1);
    }
    
    const user = existingUser.rows[0];
    console.log(`✓ Found user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    
    // Check current password hash
    const currentHash = user.password_hash;
    if (currentHash && currentHash.startsWith('$2')) {
      console.log('Current password appears to be properly hashed (bcrypt format)');
      
      // Test if the current password works
      try {
        const testResult = await bcrypt.compare(newPassword, currentHash);
        if (testResult) {
          console.log('✓ Password is already correct - no update needed');
          await pool.end();
          return;
        }
      } catch (error) {
        console.log('Current hash appears corrupted, will update...');
      }
    } else {
      console.log('⚠ Current password is not properly hashed (plain text detected)');
    }
    
    // Hash the new password
    console.log('Hashing new password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Verify the hash works
    const verifyHash = await bcrypt.compare(newPassword, hashedPassword);
    if (!verifyHash) {
      throw new Error('Password hashing verification failed');
    }
    
    console.log('✓ Password hashed and verified successfully');
    console.log(`  Salt rounds: ${saltRounds}`);
    console.log(`  Hash length: ${hashedPassword.length}`);
    console.log(`  Hash format: ${hashedPassword.substring(0, 7)}... (bcrypt)`);
    
    // Update the user's password
    const updateResult = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, role',
      [hashedPassword, email]
    );
    
    const updatedUser = updateResult.rows[0];
    console.log('\n✓ User password updated successfully!');
    console.log(`- ID: ${updatedUser.id}`);
    console.log(`- Email: ${updatedUser.email}`);
    console.log(`- Role: ${updatedUser.role}`);
    console.log('\nYou can now log in with the new password.');
    
    await pool.end();
    
  } catch (error) {
    console.error('✗ Error fixing user password:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection failed. Please check:');
      console.error('1. PostgreSQL service is running');
      console.error('2. DATABASE_URL environment variable is set correctly');
      console.error('3. Database exists and is accessible');
    }
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\nOperation cancelled by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nOperation terminated');
  process.exit(0);
});

fixUserPassword().catch(console.error);