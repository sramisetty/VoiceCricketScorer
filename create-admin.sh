#!/bin/bash

# Interactive script to create admin user with proper password hashing
echo "=== Score Pro Admin User Creation ==="
echo ""

# Check current directory
if [ ! -f "package.json" ]; then
    echo "Changing to application directory..."
    cd /opt/cricket-scorer || cd /root/cricket-scorer || {
        echo "Error: Could not find application directory"
        exit 1
    }
fi

echo "Current directory: $(pwd)"

# Check if required files exist
if [ ! -f "create-admin-user.js" ]; then
    echo "✗ create-admin-user.js script not found"
    echo "Please ensure all required files are present"
    exit 1
fi

# Interactive input
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
read -p "First Name (optional): " first_name
read -p "Last Name (optional): " last_name

# Set defaults if empty
if [ -z "$first_name" ]; then
    first_name="Admin"
fi

if [ -z "$last_name" ]; then
    last_name="User"
fi

echo ""
echo "Creating admin user with the following details:"
echo "Email: $admin_email"
echo "Name: $first_name $last_name"
echo "Role: global_admin"
echo ""

# Create the admin user
echo "Running admin user creation script..."
node create-admin-user.js "$admin_email" "$admin_password" "$first_name" "$last_name"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Admin user creation completed successfully!"
    echo ""
    echo "You can now:"
    echo "1. Log in to the application at: https://score.ramisetty.net"
    echo "2. Use email: $admin_email"
    echo "3. Use the password you just set"
    echo ""
    echo "If login still doesn't work, you can fix the password with:"
    echo "node fix-user-password.js $admin_email <new_password>"
else
    echo ""
    echo "✗ Admin user creation failed"
    echo "Check the error messages above for troubleshooting"
    echo ""
    echo "Common solutions:"
    echo "1. Ensure database is running: sudo systemctl status postgresql"  
    echo "2. Check database connection: node quick-database-test.cjs"
    echo "3. Verify .env file contains correct DATABASE_URL"
fi