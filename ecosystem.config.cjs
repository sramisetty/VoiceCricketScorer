module.exports = {
  apps: [
    {
      name: 'cricket-scorer',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Add your actual environment variables here
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:password@host:port/database',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        SESSION_SECRET: process.env.SESSION_SECRET || 'secure_session_secret'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:password@host:port/database',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        SESSION_SECRET: process.env.SESSION_SECRET || 'secure_session_secret'
      },
      // PM2 Configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      
      // Application Health
      min_uptime: '10s',
      max_restarts: 10,
      
      // Process Management
      kill_timeout: 5000,
      listen_timeout: 8000,
      
      // Environment Variables loaded from system or PM2 config
      // No env_file dependency for production security
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: '67.227.251.94',
      ref: 'origin/main',
      repo: 'https://github.com/sramisetty/VoiceCricketScorer.git',
      path: '/opt/cricket-scorer',
      'pre-deploy-local': '',
'post-deploy': 'npm install && NODE_ENV=production npx vite build --config vite.config.production.ts --outDir server/public --emptyOutDir --mode production && npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external --format=esm --minify --define:process.env.NODE_ENV=\"production\" && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};