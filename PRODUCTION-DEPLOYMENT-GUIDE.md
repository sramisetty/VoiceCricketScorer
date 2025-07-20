# Production Deployment Guide

## Environment Variable Management for Git Deployment

Since `.env.production` is a template that should stay in git, here's how to properly handle secrets in production:

### Step 1: Clone and Setup

```bash
# Clone from GitHub
git clone https://github.com/sramisetty/VoiceCricketScorer.git /opt/cricket-scorer
cd /opt/cricket-scorer

# Install dependencies
npm install
```

### Step 2: Environment Configuration (Choose One Method)

#### Method A: Direct Environment Variables (Most Secure)
```bash
# Set in current shell session
export DATABASE_URL="postgresql://your_user:your_password@your_host:5432/your_database"
export OPENAI_API_KEY="sk-your_actual_openai_api_key_here"
export SESSION_SECRET="$(openssl rand -base64 32)"

# Make permanent (add to ~/.bashrc or ~/.profile)
echo 'export DATABASE_URL="postgresql://your_user:your_password@your_host:5432/your_database"' >> ~/.bashrc
echo 'export OPENAI_API_KEY="sk-your_actual_openai_api_key_here"' >> ~/.bashrc
echo 'export SESSION_SECRET="your_secure_session_secret"' >> ~/.bashrc
source ~/.bashrc
```

#### Method B: Local Environment File (Git-Ignored)
```bash
# Create local environment file (not tracked by git)
cp .env.production .env.local

# Edit with actual values
nano .env.local

# Load environment variables
source .env.local
```

#### Method C: PM2 Configuration File
```bash
# Edit PM2 config with actual values
nano ecosystem.config.cjs

# Replace placeholders in env section:
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  DATABASE_URL: 'postgresql://actual_user:actual_password@actual_host:5432/actual_database',
  OPENAI_API_KEY: 'sk-actual_openai_api_key_here',
  SESSION_SECRET: 'actual_secure_session_secret'
}
```

### Step 3: Build Application

```bash
# Build client to server/public/ (where Express expects static files)
npx vite build --outDir server/public --emptyOutDir

# Build server to dist/index.js
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# Set permissions
chmod -R 755 server/public/ dist/
```

### Step 4: Test Environment Variables

```bash
# Verify environment variables are set
echo "DATABASE_URL: $DATABASE_URL"
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..." # Show only first 10 chars
echo "SESSION_SECRET: ${SESSION_SECRET:0:10}..."

# Test application startup
node dist/index.js
# Should see: "OpenAI API key loaded..." and "express serving on port 3000"
```

### Step 5: Deploy with PM2

```bash
# Start with PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

### Step 6: Nginx Configuration (if using reverse proxy)

```bash
# Restart nginx if needed
systemctl restart nginx

# Test public access
curl -I https://score.ramisetty.net/
```

## Security Best Practices

1. **Never commit actual secrets** - Use templates only
2. **Use strong session secrets** - Generate with `openssl rand -base64 32`
3. **Secure database connections** - Use SSL/TLS for database connections
4. **Environment isolation** - Keep production secrets separate from development
5. **Regular rotation** - Rotate API keys and secrets periodically

## Troubleshooting

### DATABASE_URL Error
- Verify environment variable is set: `echo $DATABASE_URL`
- Check database connectivity: `psql $DATABASE_URL -c "SELECT 1;"`
- Ensure PM2 has access to environment variables

### Build Failures
- Check Node.js version: `node --version` (should be 20+)
- Verify dependencies: `npm list`
- Clean build: `rm -rf dist/ server/public/ && npm run build`

### Static Files 404
- Ensure client built to `server/public/`: `ls -la server/public/`
- Check Express static middleware configuration
- Verify file permissions: `chmod -R 755 server/public/`

This approach keeps your secrets secure while allowing the template to be version controlled.