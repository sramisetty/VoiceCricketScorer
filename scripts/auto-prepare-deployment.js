#!/usr/bin/env node

/**
 * Automated Schema Deployment Preparation
 * Automates the 4-step workflow when preparing deploy-cricket-scorer.sh
 * 
 * This script:
 * 1. Analyzes shared/schema.ts for all tables and columns
 * 2. Generates production-safe SQL with IF NOT EXISTS patterns
 * 3. Updates deploy-cricket-scorer.sh automatically
 * 4. Validates the final result
 */

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Automated Schema Deployment Preparation');
console.log('==========================================');

// File paths
const schemaPath = path.join(__dirname, '../shared/schema.ts');
const deployPath = path.join(__dirname, '../deploy-cricket-scorer.sh');

if (!fs.existsSync(schemaPath)) {
    console.error('❌ shared/schema.ts not found');
    process.exit(1);
}

if (!fs.existsSync(deployPath)) {
    console.error('❌ deploy-cricket-scorer.sh not found');
    process.exit(1);
}

console.log('📊 Step 1: Analyzing schema.ts...');

const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Extract table definitions with detailed column analysis
const tableMatches = schemaContent.match(/export const (\w+) = pgTable\("(\w+)",\s*{([^}]+)}/gs);
const tables = [];

if (tableMatches) {
    tableMatches.forEach(match => {
        const [, varName, tableName] = match.match(/export const (\w+) = pgTable\("(\w+)"/);
        
        // Extract columns from the table definition
        const columnSection = match.match(/{([^}]+)}/s)[1];
        const columnMatches = columnSection.match(/(\w+):\s*[^,\n]+(?:,|\s*$)/g);
        
        const columns = [];
        if (columnMatches) {
            columnMatches.forEach(colMatch => {
                const colName = colMatch.match(/(\w+):/)[1];
                const colDef = colMatch.trim();
                
                // Determine SQL type from Drizzle definition
                let sqlType = 'TEXT';
                let constraints = '';
                
                if (colDef.includes('serial(')) {
                    sqlType = 'SERIAL';
                    if (colDef.includes('.primaryKey()')) constraints = 'PRIMARY KEY';
                } else if (colDef.includes('integer(')) {
                    sqlType = 'INTEGER';
                    if (colDef.includes('.references(')) {
                        const refMatch = colDef.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+)\)/);
                        if (refMatch) constraints = `REFERENCES ${refMatch[1]}(${refMatch[2]})`;
                    }
                } else if (colDef.includes('text(')) {
                    sqlType = 'TEXT';
                } else if (colDef.includes('varchar(')) {
                    sqlType = 'VARCHAR(255)';
                } else if (colDef.includes('boolean(')) {
                    sqlType = 'BOOLEAN';
                } else if (colDef.includes('timestamp(')) {
                    sqlType = 'TIMESTAMP';
                } else if (colDef.includes('jsonb(')) {
                    sqlType = 'JSONB';
                }
                
                if (colDef.includes('.notNull()')) constraints += ' NOT NULL';
                if (colDef.includes('.defaultNow()')) constraints += ' DEFAULT NOW()';
                if (colDef.includes('.default(false)')) constraints += ' DEFAULT false';
                if (colDef.includes('.default(true)')) constraints += ' DEFAULT true';
                
                // Extract default values
                const defaultMatch = colDef.match(/\.default\(([^)]+)\)/);
                if (defaultMatch && !constraints.includes('DEFAULT')) {
                    const defaultVal = defaultMatch[1];
                    if (defaultVal.includes("'") || defaultVal.includes('"')) {
                        constraints += ` DEFAULT ${defaultVal}`;
                    } else if (!isNaN(defaultVal)) {
                        constraints += ` DEFAULT ${defaultVal}`;
                    }
                }
                
                columns.push({
                    name: colName,
                    sqlType,
                    constraints: constraints.trim()
                });
            });
        }
        
        tables.push({ varName, tableName, columns });
    });
}

console.log(`✅ Found ${tables.length} tables with detailed column analysis`);
tables.forEach(table => {
    console.log(`  - ${table.tableName}: ${table.columns.length} columns`);
});

console.log('\n🔧 Step 2: Generating production-safe SQL...');

// Generate CREATE TABLE statements
let createTableSQL = '';
let columnCheckSQL = '';

tables.forEach(table => {
    // Create table SQL
    createTableSQL += `
-- Create ${table.tableName} table if it doesn't exist
CREATE TABLE IF NOT EXISTS ${table.tableName} (
${table.columns.map(col => `    ${col.name} ${col.sqlType}${col.constraints ? ' ' + col.constraints : ''}`).join(',\n')}
);
`;

    // Column check SQL
    columnCheckSQL += `
-- Add missing columns to ${table.tableName} if they don't exist
DO $$ 
BEGIN
${table.columns.map(col => `    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table.tableName}' AND column_name='${col.name}') THEN
        ALTER TABLE ${table.tableName} ADD COLUMN ${col.name} ${col.sqlType}${col.constraints ? ' ' + col.constraints : ''};
    END IF;`).join('\n')}
END $$;
`;
});

console.log('✅ Generated comprehensive SQL for all tables and columns');

console.log('\n📝 Step 3: Updating deploy-cricket-scorer.sh...');

const deployContent = fs.readFileSync(deployPath, 'utf8');

// Find the database schema section and replace it
const schemaStartMarker = '-- Production-Safe Cricket Scorer Database Schema Migration';
const schemaEndMarker = 'SAFE_SCHEMA_EOF';

const schemaStartIndex = deployContent.indexOf(schemaStartMarker);
const schemaEndIndex = deployContent.indexOf(schemaEndMarker);

if (schemaStartIndex === -1 || schemaEndIndex === -1) {
    console.error('❌ Could not find schema section markers in deploy script');
    console.log('Expected markers:');
    console.log('- "-- Production-Safe Cricket Scorer Database Schema Migration"');
    console.log('- "SAFE_SCHEMA_EOF"');
    process.exit(1);
}

// Create new schema section with production-safe SQL
const newSchemaSection = `-- Production-Safe Cricket Scorer Database Schema Migration
-- This creates/updates schema without losing existing data
--
-- KEY PRODUCTION SAFETY FEATURES:
-- 1. CREATE TABLE IF NOT EXISTS - Only creates tables if they don't exist
-- 2. ALTER TABLE ADD COLUMN IF NOT EXISTS - Only adds new columns safely  
-- 3. INSERT...WHERE NOT EXISTS - Only inserts sample data if tables are empty
-- 4. No DROP statements - Never destroys existing data
-- 5. Incremental migration support - Perfect for production updates
--
-- This approach allows:
-- - Fresh deployments (creates all tables from scratch)
-- - Production updates (adds new columns/constraints without data loss)
-- - Schema evolution (supports future enhancements safely)
-- - Zero downtime deployments (existing data preserved)

${createTableSQL}
${columnCheckSQL}

-- Sample data insertion (safe patterns with WHERE NOT EXISTS)
-- Insert admin user if not exists
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
SELECT 'admin@cricket.com', 'admin123', 'Admin', 'User', 'admin', true, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@cricket.com');

-- Insert sample franchise if not exists
INSERT INTO franchises (name, short_name, is_active, created_at, updated_at)
SELECT 'Default Franchise', 'DEFAULT', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM franchises WHERE short_name = 'DEFAULT');

`;

// Replace the schema section
const beforeSchema = deployContent.substring(0, schemaStartIndex);
const afterSchema = deployContent.substring(schemaEndIndex);
const updatedDeployContent = beforeSchema + newSchemaSection + afterSchema;

// Update table count in verification section
const tableCountPattern = /COUNT\(\*\) = (\d+)/;
const updatedContentWithCount = updatedDeployContent.replace(
    tableCountPattern, 
    `COUNT(*) = ${tables.length}`
);

// Write updated deploy script
fs.writeFileSync(deployPath, updatedContentWithCount);

console.log('✅ Updated deploy-cricket-scorer.sh with new schema');

console.log('\n🔍 Step 4: Running validation...');

try {
    execSync('./validate-schema.sh', { stdio: 'inherit' });
    console.log('\n🎉 AUTOMATED PREPARATION COMPLETE!');
    console.log('=====================================');
    console.log('✅ Schema analyzed and extracted');
    console.log('✅ Production-safe SQL generated');
    console.log('✅ Deployment script updated');
    console.log('✅ Validation passed');
    console.log('\n🚀 Ready for production deployment!');
    console.log('Run: ./deploy-cricket-scorer.sh');
    
} catch (error) {
    console.error('\n❌ Validation failed!');
    console.error('The automated preparation detected issues.');
    console.error('Please review the validation output above.');
    process.exit(1);
}