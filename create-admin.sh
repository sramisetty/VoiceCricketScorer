#!/bin/bash

# Script to create initial admin user for Score Pro
# Usage: ./create-admin.sh

echo "=== Score Pro Admin User Creation ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL before running this script"
    exit 1
fi

# Prompt for admin details
read -p "Enter admin email: " ADMIN_EMAIL
while true; do
    read -s -p "Enter admin password (minimum 8 characters): " ADMIN_PASSWORD
    echo
    read -s -p "Confirm admin password: " ADMIN_PASSWORD_CONFIRM
    echo
    
    if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
        if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
            break
        else
            echo "Password must be at least 8 characters long. Please try again."
        fi
    else
        echo "Passwords do not match. Please try again."
    fi
done

read -p "Enter admin first name (default: System): " ADMIN_FIRST_NAME
ADMIN_FIRST_NAME=${ADMIN_FIRST_NAME:-System}

read -p "Enter admin last name (default: Administrator): " ADMIN_LAST_NAME
ADMIN_LAST_NAME=${ADMIN_LAST_NAME:-Administrator}

echo ""
echo "Creating admin user with:"
echo "- Email: $ADMIN_EMAIL"
echo "- Name: $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"
echo "- Role: global_admin"
echo ""

# Create the admin user using Node.js
node create-admin-user.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_FIRST_NAME" "$ADMIN_LAST_NAME"

echo ""
echo "Admin user creation completed!"
echo "You can now access the Score Pro application at your domain and log in with the admin credentials."