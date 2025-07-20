# Cricket Scorer Production Build Commands

## Individual Build Commands

### Build Client Only
```bash
# Build React frontend to dist/public/ (default Vite output)
npx vite build

# OR build to specific directory (server/public/ where Express expects it)
npx vite build --outDir server/public --emptyOutDir
```

### Build Server Only
```bash
# Build Express server to dist/index.js
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm
```

### Build Both Together
```bash
# Option 1: Use existing npm script (builds to dist/public/)
npm run build

# Option 2: Build both with correct paths for production
npx vite build --outDir server/public --emptyOutDir && npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm
```

## Production Deployment Sequence

```bash
# 1. Navigate to application directory
cd /opt/cricket-scorer

# 2. Build both client and server
npx vite build --outDir server/public --emptyOutDir
npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm

# 3. Set permissions
chmod -R 755 server/public/
chmod -R 755 dist/

# 4. Start with PM2
pm2 start ecosystem.config.cjs

# 5. Restart web server
systemctl restart nginx
```

## Key Points

- **Client Output**: Build to `server/public/` where Express static middleware expects files
- **Server Output**: Build to `dist/index.js` where PM2 expects the entry point
- **Static Assets**: CSS/JS files must be in `server/public/assets/` for Express to serve them
- **Format**: Use ESM format for server build to match project configuration

## Testing Build Output

```bash
# Verify client build
ls -la server/public/index.html
ls -la server/public/assets/

# Verify server build  
ls -la dist/index.js

# Test server locally
node dist/index.js
```