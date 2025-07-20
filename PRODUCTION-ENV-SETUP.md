# Production Environment Setup (No dotenv)

## Environment Variable Management

For production deployment without dotenv dependency, use system environment variables or PM2 configuration.

### Method 1: Interactive Setup Script (Recommended)

Run the interactive environment configuration script:

```bash
# Make script executable (if needed)
chmod +x setup-production-env.sh

# Run interactive setup
./setup-production-env.sh
```

The script will prompt you for:
- Database connection details (host, port, name, username, password)
- OpenAI API key
- SSL configuration (optional)
- Automatic session secret generation

Features:
- ✅ Input validation and error checking
- ✅ Secure password masking
- ✅ Automatic session secret generation
- ✅ Database connection testing
- ✅ Secure file permissions (600)
- ✅ Configuration summary and confirmation

### Method 2: System Environment Variables

```bash
# Set environment variables at system level
export DATABASE_URL="postgresql://your_user:your_password@your_host:5432/your_database"
export OPENAI_API_KEY="sk-your_actual_openai_api_key_here"
export SESSION_SECRET="your_secure_random_session_secret"
export NODE_ENV="production"
export PORT="3000"

# Test the application
node dist/index.js
```

### Method 2: PM2 Environment Configuration

Edit `ecosystem.config.cjs` with your actual values:

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  DATABASE_URL: 'postgresql://your_user:your_password@your_host:5432/your_database',
  OPENAI_API_KEY: 'sk-your_actual_openai_api_key_here',
  SESSION_SECRET: 'your_secure_session_secret'
},
```

### Method 3: Systemd Service (Production Server)

Create `/etc/systemd/system/cricket-scorer.service`:

```ini
[Unit]
Description=Cricket Scorer Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cricket-scorer
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

# Environment Variables
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=postgresql://your_user:your_password@your_host:5432/your_database
Environment=OPENAI_API_KEY=sk-your_actual_openai_api_key_here
Environment=SESSION_SECRET=your_secure_session_secret

[Install]
WantedBy=multi-user.target
```

### Method 4: Shell Script Wrapper

Create `start-production.sh`:

```bash
#!/bin/bash
export DATABASE_URL="postgresql://your_user:your_password@your_host:5432/your_database"
export OPENAI_API_KEY="sk-your_actual_openai_api_key_here"
export SESSION_SECRET="your_secure_session_secret"
export NODE_ENV="production"
export PORT="3000"

node dist/index.js
```

## Production Deployment Commands

```bash
# 1. Navigate to application directory
cd /opt/cricket-scorer

# 2. Build application
npx vite build --outDir server/public --emptyOutDir
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# 3. Set environment variables (choose one method above)
export DATABASE_URL="your_actual_database_url"
export OPENAI_API_KEY="your_actual_openai_key"
export SESSION_SECRET="your_secure_session_secret"

# 4. Test application
node dist/index.js

# 5. Start with PM2
pm2 start ecosystem.config.cjs --env production
```

## Security Benefits

- ✅ No file-based secrets (.env files)
- ✅ Environment variables managed at system level
- ✅ PM2 process isolation
- ✅ Reduced attack surface
- ✅ Production-grade security practices

## Troubleshooting

If you get DATABASE_URL errors:

1. **Check environment variables are set:**
   ```bash
   echo $DATABASE_URL
   echo $OPENAI_API_KEY
   ```

2. **Verify PM2 environment:**
   ```bash
   pm2 env cricket-scorer
   ```

3. **Test manual start:**
   ```bash
   DATABASE_URL="your_url" OPENAI_API_KEY="your_key" node dist/index.js
   ```

This approach eliminates dotenv dependency and follows production security best practices.