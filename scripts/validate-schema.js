#!/usr/bin/env node

/**
 * Schema Validation Script
 * Validates that shared/schema.ts changes are reflected in deploy-cricket-scorer.sh
 * Prevents schema deployment mismatches
 */

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Cricket Scorer Schema Validation');
console.log('=====================================');

// Read shared/schema.ts
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

const schemaContent = fs.readFileSync(schemaPath, 'utf8');
const deployContent = fs.readFileSync(deployPath, 'utf8');

// Extract table definitions from schema.ts
const tableMatches = schemaContent.match(/export const (\w+) = pgTable\("(\w+)"/g);
const tables = [];

if (tableMatches) {
    tableMatches.forEach(match => {
        const [, varName, tableName] = match.match(/export const (\w+) = pgTable\("(\w+)"/);
        tables.push({ varName, tableName });
    });
}

console.log(`📊 Found ${tables.length} tables in schema.ts:`);
tables.forEach(table => {
    console.log(`  - ${table.tableName} (${table.varName})`);
});

// Check if each table exists in deploy script
const missingTables = [];
const missingColumnChecks = [];

tables.forEach(table => {
    const createTablePattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${table.tableName}`, 'i');
    const hasCreateTable = createTablePattern.test(deployContent);
    
    if (!hasCreateTable) {
        missingTables.push(table.tableName);
    }
    
    // Check for column validation block
    const columnCheckPattern = new RegExp(`Add missing columns to ${table.tableName} if they don't exist`, 'i');
    const hasColumnChecks = columnCheckPattern.test(deployContent);
    
    if (!hasColumnChecks) {
        missingColumnChecks.push(table.tableName);
    }
});

// Report results
console.log('\n📋 Validation Results:');
console.log('=====================');

if (missingTables.length === 0) {
    console.log('✅ All tables have CREATE TABLE IF NOT EXISTS statements');
} else {
    console.log('❌ Missing CREATE TABLE statements for:');
    missingTables.forEach(table => {
        console.log(`  - ${table}`);
    });
}

if (missingColumnChecks.length === 0) {
    console.log('✅ All tables have column validation blocks');
} else {
    console.log('❌ Missing column validation blocks for:');
    missingColumnChecks.forEach(table => {
        console.log(`  - ${table}`);
    });
}

// Check for table count verification
const tableCountPattern = /COUNT\(\*\) = (\d+)/;
const tableCountMatch = deployContent.match(tableCountPattern);
const expectedTableCount = tables.length;

if (tableCountMatch) {
    const actualCount = parseInt(tableCountMatch[1]);
    if (actualCount === expectedTableCount) {
        console.log(`✅ Table count verification matches (${expectedTableCount})`);
    } else {
        console.log(`❌ Table count mismatch: deploy script expects ${actualCount}, schema has ${expectedTableCount}`);
    }
} else {
    console.log('❌ No table count verification found in deploy script');
}

// Generate recommendations
console.log('\n💡 Recommendations:');
console.log('==================');

if (missingTables.length > 0 || missingColumnChecks.length > 0) {
    console.log('1. Update deploy-cricket-scorer.sh with missing table definitions');
    console.log('2. Add comprehensive column checks for all missing tables');
    console.log('3. Test locally with npm run db:push');
    console.log('4. Run this validation script again');
    
    // Generate template for missing tables
    if (missingTables.length > 0) {
        console.log('\n📝 Template for missing tables:');
        missingTables.forEach(tableName => {
            console.log(`
-- Create ${tableName} table if it doesn't exist
CREATE TABLE IF NOT EXISTS ${tableName} (
    id SERIAL PRIMARY KEY,
    -- Add your columns here based on shared/schema.ts
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns to ${tableName} if they don't exist
DO $$ 
BEGIN
    -- Add column checks here for each column in shared/schema.ts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${tableName}' AND column_name='created_at') THEN
        ALTER TABLE ${tableName} ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;
`);
        });
    }
} else {
    console.log('✅ Schema appears to be in sync!');
    console.log('✅ Ready for safe production deployment');
}

console.log('\n🚀 Next Steps:');
console.log('1. Fix any issues identified above');
console.log('2. Run npm run db:push to test locally');
console.log('3. Deploy using ./deploy-cricket-scorer.sh');

// Exit with error code if issues found
const hasIssues = missingTables.length > 0 || missingColumnChecks.length > 0;
process.exit(hasIssues ? 1 : 0);