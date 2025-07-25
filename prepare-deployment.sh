#!/bin/bash

# Automated Schema Deployment Preparation Wrapper
# Single command to prepare deploy-cricket-scorer.sh for production

echo "🚀 Preparing deploy-cricket-scorer.sh for production deployment..."
echo "================================================================="

# Check if automation script exists
if [ ! -f "scripts/auto-prepare-deployment.js" ]; then
    echo "❌ Automation script not found"
    exit 1
fi

# Run the automated preparation
node scripts/auto-prepare-deployment.js

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT PREPARATION COMPLETE!"
    echo "=================================="
    echo ""
    echo "✅ All 4 steps automated successfully:"
    echo "  1. ✅ Schema analysis completed"
    echo "  2. ✅ Local testing simulated"
    echo "  3. ✅ Deployment script updated"
    echo "  4. ✅ Validation passed"
    echo ""
    echo "🚀 Ready to deploy to production:"
    echo "   ./deploy-cricket-scorer.sh"
    echo ""
else
    echo ""
    echo "❌ PREPARATION FAILED!"
    echo "===================="
    echo "Please review the error messages above."
    exit 1
fi