#!/bin/bash

# Comprehensive admin user setup script with environment loading and validation
echo "=== Score Pro Admin User Setup ==="
echo "This script will help you create or fix admin user accounts"
echo ""

# Function to load environment variables
load_env() {
    if [ -f ".env" ]; then
        echo "✓ Loading environment variables from .env..."
        set -a  # automatically export all variables
        source .env 2>/dev/null
        set +a  # stop auto-exporting
        
        if [ -n "$DATABASE_URL" ]; then
            echo "✓ DATABASE_URL loaded successfully"
        else
            echo "✗ DATABASE_URL not found in .env file"
            return 1
        fi
    else
        echo "✗ .env file not found"
        echo "Please ensure .env file exists with DATABASE_URL configuration"
        return 1
    fi
}

# Function to test database connection
test_database() {
    echo "Testing database connection..."
    if [ -f "quick-database-test.cjs" ]; then
        if node quick-database-test.cjs >/dev/null 2>&1; then
            echo "✓ Database connection successful"
            return 0
        else
            echo "✗ Database connection failed"
            return 1
        fi
    else
        echo "⚠ Database test script not found"
        return 1
    fi
}

# Function to check existing admin users
check_existing_admins() {
    if command -v psql >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
        ADMIN_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'global_admin');" 2>/dev/null | xargs)
        if [ "$ADMIN_COUNT" -gt 0 ]; then
            echo "Found $ADMIN_COUNT existing admin users:"
            psql "$DATABASE_URL" -c "SELECT id, email, first_name, last_name, role FROM users WHERE role IN ('admin', 'global_admin');" 2>/dev/null
            return 0
        else
            echo "No admin users found in database"
            return 1
        fi
    else
        echo "Cannot check existing users (psql not available or DATABASE_URL not set)"
        return 1
    fi
}

# Change to application directory
if [ ! -f "package.json" ]; then
    echo "Changing to application directory..."
    cd /opt/cricket-scorer || cd /root/cricket-scorer || {
        echo "✗ Could not find application directory"
        echo "Please run this script from the Score Pro application directory"
        exit 1
    }
fi

echo "Current directory: $(pwd)"

# Load environment variables
if ! load_env; then
    exit 1
fi

# Test database connection
if ! test_database; then
    echo ""
    echo "Database connection failed. Attempting to fix..."
    if [ -f "fix-database-connection.sh" ]; then
        ./fix-database-connection.sh
    else
        echo "Database fix script not found. Please check database manually."
        exit 1
    fi
fi

echo ""
echo "=== Admin User Management Options ==="
echo ""

# Check for existing admin users
if check_existing_admins; then
    echo ""
    echo "What would you like to do?"
    echo "1) Create a new admin user"
    echo "2) Fix/update password for existing user"
    echo "3) Exit"
    echo ""
    read -p "Choose option (1-3): " choice
else
    echo ""
    echo "What would you like to do?"
    echo "1) Create a new admin user"
    echo "2) Exit"
    echo ""
    read -p "Choose option (1-2): " choice
fi

case $choice in
    1)
        echo ""
        echo "=== Creating New Admin User ==="
        
        # Check if required scripts exist
        if [ ! -f "create-admin-user.js" ]; then
            echo "✗ create-admin-user.js script not found"
            exit 1
        fi
        
        # Get admin details interactively
        echo "Please provide admin user details:"
        echo ""
        
        # Get email
        while true; do
            read -p "Admin Email: " admin_email
            if [[ "$admin_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                break
            else
                echo "Please enter a valid email address"
            fi
        done
        
        # Get password (hidden input)
        while true; do
            read -s -p "Admin Password (min 8 chars): " admin_password
            echo ""
            if [ ${#admin_password} -ge 8 ]; then
                read -s -p "Confirm Password: " confirm_password
                echo ""
                if [ "$admin_password" = "$confirm_password" ]; then
                    break
                else
                    echo "Passwords do not match. Please try again."
                fi
            else
                echo "Password must be at least 8 characters long"
            fi
        done
        
        # Get optional name fields
        read -p "First Name (default: Admin): " first_name
        read -p "Last Name (default: User): " last_name
        
        # Set defaults if empty
        if [ -z "$first_name" ]; then
            first_name="Admin"
        fi
        
        if [ -z "$last_name" ]; then
            last_name="User"
        fi
        
        echo ""
        echo "Creating admin user..."
        echo "Email: $admin_email"
        echo "Name: $first_name $last_name"
        echo "Role: global_admin"
        echo ""
        
        # Create the admin user
        if node create-admin-user.js "$admin_email" "$admin_password" "$first_name" "$last_name"; then
            echo ""
            echo "✓ Admin user created successfully!"
            echo ""
            echo "You can now log in at: https://score.ramisetty.net"
            echo "Email: $admin_email"
            echo "Password: [the password you just set]"
        else
            echo ""
            echo "✗ Failed to create admin user"
            echo "Check the error messages above for troubleshooting"
        fi
        ;;
        
    2)
        if check_existing_admins >/dev/null 2>&1; then
            echo ""
            echo "=== Fix User Password ==="
            
            # Check if fix script exists
            if [ ! -f "fix-user-password.js" ]; then
                echo "✗ fix-user-password.js script not found"
                exit 1
            fi
            
            read -p "Enter email of user to fix: " user_email
            
            # Validate email
            if [[ ! "$user_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                echo "Invalid email format"
                exit 1
            fi
            
            # Get new password
            while true; do
                read -s -p "New Password (min 8 chars): " new_password
                echo ""
                if [ ${#new_password} -ge 8 ]; then
                    read -s -p "Confirm Password: " confirm_password
                    echo ""
                    if [ "$new_password" = "$confirm_password" ]; then
                        break
                    else
                        echo "Passwords do not match. Please try again."
                    fi
                else
                    echo "Password must be at least 8 characters long"
                fi
            done
            
            echo ""
            echo "Updating password for $user_email..."
            
            if node fix-user-password.js "$user_email" "$new_password"; then
                echo ""
                echo "✓ Password updated successfully!"
                echo "You can now log in with the new password"
            else
                echo ""
                echo "✗ Failed to update password"
            fi
        else
            echo "No existing admin users found"
        fi
        ;;
        
    *)
        echo "Exiting..."
        exit 0
        ;;
esac

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Useful commands:"
echo "- Check application status: ./check-production-status.sh"
echo "- View application logs: pm2 logs cricket-scorer"
echo "- Restart application: pm2 restart cricket-scorer"
echo "- Test database: node quick-database-test.cjs"