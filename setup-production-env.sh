#!/bin/bash

# Cricket Scorer Production Environment Setup Script
# This script prompts for production configuration and creates .env file

set -e  # Exit on any error

echo "================================================="
echo "   Cricket Scorer Production Environment Setup"
echo "================================================="
echo ""

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to prompt for input with validation
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local required="$3"
    local mask="$4"
    
    while true; do
        if [ "$mask" = "true" ]; then
            echo -n -e "${BLUE}$prompt:${NC} "
            read -s input
            echo ""  # New line after hidden input
        else
            echo -n -e "${BLUE}$prompt:${NC} "
            read input
        fi
        
        if [ "$required" = "true" ] && [ -z "$input" ]; then
            echo -e "${RED}This field is required. Please enter a value.${NC}"
            continue
        fi
        
        eval "$var_name='$input'"
        break
    done
}

# Function to generate secure session secret
generate_session_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32
    else
        # Fallback if openssl not available
        cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%^&*()_+=' | fold -w 32 | head -n 1
    fi
}

# Check if .env file already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file already exists.${NC}"
    echo -n "Do you want to overwrite it? (y/N): "
    read overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
    echo ""
fi

echo "This script will help you configure your production environment."
echo "Press Enter to use default values where applicable."
echo ""

# Application Configuration
echo -e "${GREEN}=== Application Configuration ===${NC}"
prompt_input "Node Environment (default: production)" NODE_ENV false
NODE_ENV=${NODE_ENV:-production}

prompt_input "Application Port (default: 3000)" PORT false
PORT=${PORT:-3000}

echo ""

# Database Configuration
echo -e "${GREEN}=== Database Configuration ===${NC}"
echo "Enter your PostgreSQL database connection details:"

prompt_input "Database Host (e.g., localhost, your-db-host.com)" DB_HOST true
prompt_input "Database Port (default: 5432)" DB_PORT false
DB_PORT=${DB_PORT:-5432}

prompt_input "Database Name" DB_NAME true
prompt_input "Database Username" DB_USER true
prompt_input "Database Password" DB_PASSWORD true true

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo ""

# OpenAI Configuration
echo -e "${GREEN}=== OpenAI API Configuration ===${NC}"
echo "Enter your OpenAI API key (starts with sk-...):"
prompt_input "OpenAI API Key" OPENAI_API_KEY true true

echo ""

# Session Configuration
echo -e "${GREEN}=== Session Security Configuration ===${NC}"
echo "Generating secure session secret..."
SESSION_SECRET=$(generate_session_secret)
echo -e "${GREEN}✓ Session secret generated automatically${NC}"

echo ""

# SSL/TLS Configuration (optional)
echo -e "${GREEN}=== Optional SSL Configuration ===${NC}"
prompt_input "Enable SSL in production? (y/N)" ENABLE_SSL false
if [ "$ENABLE_SSL" = "y" ] || [ "$ENABLE_SSL" = "Y" ]; then
    prompt_input "SSL Certificate Path" SSL_CERT false
    prompt_input "SSL Private Key Path" SSL_KEY false
fi

echo ""

# Summary
echo -e "${GREEN}=== Configuration Summary ===${NC}"
echo "Node Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Database Host: $DB_HOST"
echo "Database Port: $DB_PORT"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo "Database Password: ****"
echo "OpenAI API Key: ${OPENAI_API_KEY:0:10}..."
echo "Session Secret: Generated (32 characters)"
if [ "$ENABLE_SSL" = "y" ] || [ "$ENABLE_SSL" = "Y" ]; then
    echo "SSL Certificate: $SSL_CERT"
    echo "SSL Private Key: $SSL_KEY"
fi

echo ""
echo -n "Save this configuration? (Y/n): "
read confirm
if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
    echo "Configuration cancelled."
    exit 0
fi

# Create .env file
echo "Creating .env file..."

cat > .env << EOF
# Cricket Scorer Production Environment
# Generated on $(date)

# Application Configuration
NODE_ENV=${NODE_ENV}
PORT=${PORT}

# Database Configuration
DATABASE_URL=${DATABASE_URL}
PGHOST=${DB_HOST}
PGPORT=${DB_PORT}
PGDATABASE=${DB_NAME}
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}

# OpenAI Configuration
OPENAI_API_KEY=${OPENAI_API_KEY}

# Session Security
SESSION_SECRET=${SESSION_SECRET}
EOF

# Add SSL configuration if enabled
if [ "$ENABLE_SSL" = "y" ] || [ "$ENABLE_SSL" = "Y" ]; then
    cat >> .env << EOF

# SSL Configuration
SSL_CERT=${SSL_CERT}
SSL_KEY=${SSL_KEY}
EOF
fi

# Set secure permissions
chmod 600 .env

echo ""
echo -e "${GREEN}✓ Environment configuration saved to .env${NC}"
echo -e "${YELLOW}✓ File permissions set to 600 (owner read/write only)${NC}"
echo ""

# Test database connection
echo "Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo "Please verify your database credentials and ensure the database is running."
    fi
else
    echo -e "${YELLOW}⚠ psql not found. Skipping database connection test.${NC}"
fi

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "1. Build the application:"
echo "   npm install"
echo "   npx vite build --outDir server/public --emptyOutDir"
echo "   npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm"
echo ""
echo "2. Test the application:"
echo "   node dist/index.js"
echo ""
echo "3. Start with PM2:"
echo "   pm2 start ecosystem.config.cjs"
echo ""
echo -e "${GREEN}Production environment setup complete!${NC}"