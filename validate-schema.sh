#!/bin/bash

# Schema Validation Script
# Quick wrapper to run the Node.js schema validation

echo "🔍 Running Cricket Scorer Schema Validation..."
echo "=============================================="

# Check if Node.js script exists
if [ ! -f "scripts/validate-schema.js" ]; then
    echo "❌ Schema validation script not found"
    exit 1
fi

# Run the validation
node scripts/validate-schema.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema validation passed!"
    echo "🚀 Ready for deployment"
else
    echo ""
    echo "❌ Schema validation failed!"
    echo "⚠️  Please fix issues before deploying"
    exit 1
fi