#!/bin/bash

# Script to clean up temporary and redundant files
echo "=== Score Pro Script Cleanup ==="
echo ""

# List of temporary/redundant files to remove
TEMP_FILES=(
    "create-admin.sh"           # Replaced by setup-admin-user.sh
    "load-env-and-test.sh"      # Functionality integrated into other scripts
    "test-database-connection.js" # Keep quick-database-test.cjs instead
)

# List of files to keep (core production scripts)
KEEP_FILES=(
    "setup-admin-user.sh"       # Main admin user management
    "check-production-status.sh" # Production health check
    "fix-database-connection.sh" # Database troubleshooting
    "create-admin-user.js"      # Core admin creation script
    "fix-user-password.js"      # Password fixing utility
    "quick-database-test.cjs"   # Database connectivity test
    "deploy-cricket-scorer.sh"  # Main deployment script
    "setup-almalinux-production.sh" # Server setup script
    "setup-production-env.sh"   # Environment configuration
)

echo "Files to be removed:"
for file in "${TEMP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  - $file"
    fi
done

echo ""
echo "Files that will be kept (core scripts):"
for file in "${KEEP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ⚠ $file (missing)"
    fi
done

echo ""
read -p "Do you want to proceed with cleanup? (y/N): " confirm

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "Cleaning up temporary files..."
    
    for file in "${TEMP_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm "$file"
            echo "✓ Removed $file"
        else
            echo "- $file (not found)"
        fi
    done
    
    echo ""
    echo "✓ Cleanup completed!"
    echo ""
    echo "Remaining production scripts:"
    ls -la *.sh *.js *.cjs 2>/dev/null | grep -E '\.(sh|js|cjs)$' || echo "No script files found"
    
    echo ""
    echo "Main scripts for production use:"
    echo "  ./setup-admin-user.sh          - Create/manage admin users"
    echo "  ./check-production-status.sh   - Check application health"
    echo "  ./fix-database-connection.sh   - Fix database issues"
    echo "  ./deploy-cricket-scorer.sh     - Deploy application updates"
    echo ""
    echo "Database utilities:"
    echo "  node quick-database-test.cjs   - Test database connection"
    echo "  node create-admin-user.js      - Create admin user (direct)"
    echo "  node fix-user-password.js      - Fix user password (direct)"
    
else
    echo ""
    echo "Cleanup cancelled. No files were removed."
fi

echo ""
echo "=== Cleanup Complete ==="