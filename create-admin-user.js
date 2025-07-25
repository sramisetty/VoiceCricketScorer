#!/usr/bin/env node

/**
 * Script to create initial admin user on fresh deployment
 * Usage: node create-admin-user.js <email> <password> [firstName] [lastName]
 * Example: node create-admin-user.js admin@example.com securepassword Admin User
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function createAdminUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node create-admin-user.js <email> <password> [firstName] [lastName]');
    console.error('Example: node create-admin-user.js admin@example.com securepassword Admin User');
    process.exit(1);
  }

  const [email, password, firstName = 'System', lastName = 'Administrator'] = args;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Error: Invalid email format');
    process.exit(1);
  }

  // Validate password strength
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long');
    process.exit(1);
  }

  try {
    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`User with email ${email} already exists:`);
      console.log(`- ID: ${existingUser.rows[0].id}`);
      console.log(`- Role: ${existingUser.rows[0].role}`);
      
      // Ask if they want to update the role to global_admin
      if (existingUser.rows[0].role !== 'global_admin') {
        await pool.query(
          'UPDATE users SET role = $1, updated_at = NOW() WHERE email = $2',
          ['global_admin', email]
        );
        console.log(`✓ Updated user role to global_admin`);
      } else {
        console.log('✓ User already has global_admin role');
      }
      
      await pool.end();
      return;
    }

    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the admin user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, 'global_admin', true, true]
    );

    const newUser = result.rows[0];
    console.log('\n✓ Admin user created successfully!');
    console.log(`- ID: ${newUser.id}`);
    console.log(`- Email: ${newUser.email}`);
    console.log(`- Name: ${newUser.first_name} ${newUser.last_name}`);
    console.log(`- Role: ${newUser.role}`);
    console.log('\nYou can now log in to the application with these credentials.');

    await pool.end();

  } catch (error) {
    console.error('Error creating admin user:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection failed. Please check:');
      console.error('1. PostgreSQL service is running');
      console.error('2. DATABASE_URL environment variable is set correctly');
      console.error('3. Database exists and is accessible');
    } else if (error.code === '23505') {
      console.error('\nUser with this email already exists in the database.');
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

createAdminUser().catch(console.error);