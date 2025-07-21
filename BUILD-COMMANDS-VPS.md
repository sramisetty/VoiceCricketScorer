# Cricket Scorer - Linux VPS Production Build Commands

## Linux VPS Optimized Build Process

This guide provides the production build commands specifically optimized for Linux VPS deployment, removing all Replit dependencies.

### VPS Production Build (Recommended)

```bash
# Full Linux VPS production build with optimizations
cd /opt/cricket-scorer

# 1. Clean previous builds
rm -rf node_modules dist/ server/public/ package-lock.json 2>/dev/null || true

# 2. Install dependencies (optimized for VPS)
npm ci --production=false --ignore-scripts --prefer-offline

# 3. Remove Replit-specific packages (VPS deployment)
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal 2>/dev/null || true

# 4. Build client with VPS optimizations
NODE_ENV=production npx vite build --config vite.config.production.ts --outDir server/public --emptyOutDir --mode production

# 5. Build server with VPS optimizations
npx esbuild server/index.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/index.js \
    --packages=external \
    --format=esm \
    --minify \
    --sourcemap=false \
    --define:process.env.NODE_ENV=\"production\"

# 6. Set production permissions
chmod -R 755 server/public/ dist/
chown -R root:root server/public/ dist/
```

## Individual Build Commands

### Client Build (Linux VPS)
```bash
# Optimized React/Vite build for Linux VPS
NODE_ENV=production npx vite build --config vite.config.production.ts --outDir server/public --emptyOutDir --mode production
```

### Server Build (Linux VPS)
```bash
# Optimized Express server build for Linux VPS
npx esbuild server/index.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/index.js \
    --packages=external \
    --format=esm \
    --minify \
    --sourcemap=false \
    --define:process.env.NODE_ENV=\"production\"
```

## Database Setup (Linux VPS)

```bash
# Set up database schema (production)
source .env
npx drizzle-kit push --config=drizzle.config.ts --verbose
```

## PM2 Production Commands

```bash
# Start with PM2 cluster mode (Linux VPS)
pm2 start ecosystem.config.cjs --env production

# Other PM2 commands
pm2 status              # Check application status
pm2 logs cricket-scorer  # View application logs
pm2 restart cricket-scorer # Restart application
pm2 reload cricket-scorer  # Graceful reload
pm2 stop cricket-scorer    # Stop application
pm2 delete cricket-scorer  # Remove from PM2
```

## Environment Setup (Linux VPS)

```bash
# Interactive environment setup for VPS
./setup-production-env.sh

# Manual environment setup (if needed)
cp .env.production .env
# Edit .env with your production values
```

## Verification Commands

```bash
# Test builds exist
ls -la server/public/index.html  # Client build check
ls -la dist/index.js            # Server build check

# Test application locally
node dist/index.js &
curl http://localhost:3000/health
```

## Directory Structure (VPS Production)

```
/opt/cricket-scorer/
├── server/
│   ├── public/           # Built React app (Nginx serves from here)
│   │   ├── index.html
│   │   └── assets/
│   ├── index.ts         # Express server source
│   └── routes.ts        # API routes
├── client/              # React source code
├── shared/              # Shared types and schemas
├── dist/
│   └── index.js         # Built Express server (PM2 runs this)
├── vite.config.production.ts  # VPS-optimized Vite config
├── ecosystem.config.cjs       # PM2 configuration
├── .env                       # Environment variables
└── logs/                      # Application logs
```

## VPS Production Features

### Performance Optimizations
- **Minified builds** - Reduced bundle size
- **Tree shaking** - Unused code removal
- **Code splitting** - Vendor and UI chunks
- **Terser compression** - Maximum compression
- **No source maps** - Reduced file size
- **Console removal** - Clean production logs

### Build Targets
- **Modern browsers** - ES2020, Edge 88+, Chrome 87+, Firefox 78+, Safari 13+
- **Node.js 20** - Latest LTS optimizations
- **ESM modules** - Modern JavaScript standards

### Security Features
- **Production environment** - NODE_ENV=production
- **No development tools** - Replit plugins removed
- **Minimal dependencies** - Production-only packages
- **Secure permissions** - Proper file ownership

## Troubleshooting VPS Builds

### Client Build Issues
```bash
# Check Vite configuration
npx vite --version

# Debug build process
NODE_ENV=production npx vite build --config vite.config.production.ts --debug

# Check dependencies
npm list react react-dom vite
```

### Server Build Issues
```bash
# Check esbuild
npx esbuild --version

# Test server compilation
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=test.js

# Check Node.js version
node --version  # Should be 20.x
```

### Permission Issues
```bash
# Fix permissions
sudo chown -R root:root /opt/cricket-scorer/
sudo chmod -R 755 /opt/cricket-scorer/server/public/
sudo chmod -R 755 /opt/cricket-scorer/dist/
```

## Update Process (VPS)

```bash
# Quick update from repository
cd /opt/cricket-scorer
git pull origin main
npm ci --production=false --ignore-scripts --prefer-offline

# Rebuild with VPS optimizations
NODE_ENV=production npx vite build --config vite.config.production.ts --outDir server/public --emptyOutDir --mode production
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm --minify --define:process.env.NODE_ENV=\"production\"

# Restart services
pm2 restart cricket-scorer
systemctl reload nginx
```

This build process is specifically optimized for Linux VPS deployment with no Replit dependencies.