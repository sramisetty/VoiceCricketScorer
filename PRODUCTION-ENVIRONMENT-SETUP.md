# Production Environment Setup

## DATABASE_URL Error Resolution

The error you're seeing occurs because the production server doesn't have the DATABASE_URL environment variable set. Here's how to fix it:

### Quick Fix Commands for Production Server

```bash
# 1. Navigate to your app directory
cd /opt/cricket-scorer

# 2. Copy and edit the environment file
cp .env.production .env

# 3. Edit the .env file with your actual database credentials
nano .env
```

### Required Environment Variables

Edit your `.env` file and replace these placeholder values:

```bash
# Database Configuration - REPLACE WITH YOUR ACTUAL VALUES
DATABASE_URL=postgresql://your_user:your_password@your_host:5432/your_database
PGHOST=your_database_host
PGPORT=5432
PGDATABASE=your_database_name
PGUSER=your_database_user
PGPASSWORD=your_database_password

# OpenAI API Key - REPLACE WITH YOUR ACTUAL KEY
OPENAI_API_KEY=sk-your_actual_openai_api_key_here

# Session Secret - GENERATE A SECURE SECRET
SESSION_SECRET=your_very_secure_random_session_secret_here
```

### Environment Variable Loading

The production build expects environment variables to be available. You have several options:

#### Option 1: Use .env file (Recommended)
```bash
# Copy template and edit
cp .env.production .env
nano .env  # Edit with your actual values

# Test the application
node dist/index.js
```

#### Option 2: Set environment variables directly
```bash
# Set variables for current session
export DATABASE_URL="postgresql://your_user:your_password@your_host:5432/your_database"
export OPENAI_API_KEY="sk-your_actual_openai_api_key_here"
export SESSION_SECRET="your_secure_session_secret"

# Run application
node dist/index.js
```

#### Option 3: Use PM2 with environment file
```bash
# PM2 will automatically load .env file
pm2 start ecosystem.config.cjs --env production
```

### Database Setup

If you need to set up a PostgreSQL database:

```bash
# Install PostgreSQL (if not installed)
sudo yum install postgresql postgresql-server  # CentOS/RHEL
sudo apt install postgresql postgresql-contrib  # Ubuntu/Debian

# Initialize and start PostgreSQL
sudo postgresql-setup initdb  # CentOS/RHEL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE cricket_scorer;
CREATE USER cricket_user WITH PASSWORD 'secure_password_2025';
GRANT ALL PRIVILEGES ON DATABASE cricket_scorer TO cricket_user;
\q
```

### Testing the Fix

After setting up environment variables:

```bash
# Test database connection
node dist/index.js

# Should see:
# "OpenAI API key loaded..."
# "express serving on port 3000"
```

### Common Issues

1. **Wrong DATABASE_URL format**: Ensure format is `postgresql://user:password@host:port/database`
2. **Missing .env file**: Copy from .env.production and edit
3. **Database not accessible**: Check firewall and PostgreSQL settings
4. **Missing OpenAI key**: Add your actual API key to environment

### Production Checklist

- [ ] Database server running and accessible
- [ ] .env file created with actual values
- [ ] DATABASE_URL properly formatted
- [ ] OpenAI API key added
- [ ] Session secret generated
- [ ] Application builds successfully
- [ ] PM2 configured with ecosystem.config.cjs