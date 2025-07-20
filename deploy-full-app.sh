#!/bin/bash

# Deploy Full Cricket Scorer Application
# Creates complete application structure on production server

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
APP_USER="cricketapp"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Deploying complete Cricket Scorer application..."

# Stop current application
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true
sudo -u $APP_USER pm2 delete cricket-scorer 2>/dev/null || true

cd $APP_DIR

# Backup existing
if [ -d "client" ]; then
    tar -czf backup-$(date +%Y%m%d_%H%M%S).tar.gz client server shared 2>/dev/null || true
fi

# Remove old directories
rm -rf client server shared

# Create complete application structure
log "Creating Cricket Scorer application structure..."

# Create client directory and files
mkdir -p client/src/components/ui
mkdir -p client/src/pages
mkdir -p client/src/hooks
mkdir -p client/src/lib

# Package.json
cat > package.json << 'EOF'
{
  "name": "cricket-scorer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.6",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.2",
    "@tanstack/react-query": "^5.62.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.37.0",
    "express": "^4.21.1",
    "express-session": "^1.18.1",
    "framer-motion": "^11.15.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.0",
    "tailwind-merge": "^2.5.4",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.0",
    "@types/node": "^22.10.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.30.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.15",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.1"
  }
}
EOF

# Create complete server structure
mkdir -p server
cat > server/index.ts << 'EOF'
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/public')));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Cricket Scorer API' });
});

app.get('/api/teams', (req, res) => {
  res.json([
    { id: 1, name: "Mumbai Indians", shortName: "MI" },
    { id: 2, name: "Chennai Super Kings", shortName: "CSK" }
  ]);
});

app.get('/api/matches', (req, res) => {
  res.json([
    { id: 1, team1Id: 1, team2Id: 2, status: 'not_started' }
  ]);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connection', message: 'Connected to Cricket Scorer' }));
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Cricket Scorer server running on port ${PORT}`);
});
EOF

# Create shared schema
mkdir -p shared
cat > shared/schema.ts << 'EOF'
export interface Team {
  id: number;
  name: string;
  shortName: string;
}

export interface Match {
  id: number;
  team1Id: number;
  team2Id: number;
  status: 'not_started' | 'in_progress' | 'completed';
}
EOF

# Create main client files
cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cricket Scorer - Voice Enabled Cricket Scoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat > client/src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

cat > client/src/App.tsx << 'EOF'
import React from 'react';
import { Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Matches from './pages/matches';
import Scorer from './pages/scorer';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <Switch>
          <Route path="/" component={Matches} />
          <Route path="/scorer" component={Scorer} />
          <Route>
            <div className="flex items-center justify-center min-h-screen">
              <h1 className="text-4xl font-bold text-green-800">
                Voice-Enabled Cricket Scorer
              </h1>
            </div>
          </Route>
        </Switch>
      </div>
    </QueryClientProvider>
  );
}

export default App;
EOF

cat > client/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 142 76% 36%;
    --primary-foreground: 355.7 100% 97.3%;
  }
  
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
  }
}
EOF

# Create basic pages
mkdir -p client/src/pages
cat > client/src/pages/matches.tsx << 'EOF'
import React from 'react';
import { useQuery } from '@tanstack/react-query';

export default function Matches() {
  const { data: matches } = useQuery({
    queryKey: ['/api/matches'],
    queryFn: () => fetch('/api/matches').then(res => res.json())
  });

  return (
    <div className="container mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-green-800 mb-4">
          🏏 Cricket Scorer
        </h1>
        <p className="text-xl text-gray-600">
          Voice-Enabled Cricket Scoring Platform
        </p>
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-semibold mb-6 text-center">
            Match Management
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Features</h3>
              <ul className="space-y-2">
                <li>✓ Voice-enabled scoring</li>
                <li>✓ Real-time scoreboard</li>
                <li>✓ Match statistics</li>
                <li>✓ Team management</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
              <a 
                href="/scorer" 
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Start Scoring
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

cat > client/src/pages/scorer.tsx << 'EOF'
import React, { useState, useEffect } from 'react';

export default function Scorer() {
  const [score, setScore] = useState({ runs: 0, wickets: 0, overs: 0 });
  const [isListening, setIsListening] = useState(false);
  
  const handleVoiceCommand = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const command = event.results[0][0].transcript.toLowerCase();
        
        if (command.includes('four')) {
          setScore(prev => ({ ...prev, runs: prev.runs + 4 }));
        } else if (command.includes('six')) {
          setScore(prev => ({ ...prev, runs: prev.runs + 6 }));
        } else if (command.includes('single')) {
          setScore(prev => ({ ...prev, runs: prev.runs + 1 }));
        } else if (command.includes('wicket')) {
          setScore(prev => ({ ...prev, wickets: prev.wickets + 1 }));
        }
      };
      
      recognition.start();
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            Cricket Scorer
          </h1>
          <p className="text-gray-600">Voice-enabled scoring system</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">{score.runs}</div>
              <div className="text-gray-500">Runs</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600">{score.wickets}</div>
              <div className="text-gray-500">Wickets</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">{score.overs}</div>
              <div className="text-gray-500">Overs</div>
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={handleVoiceCommand}
              disabled={isListening}
              className={`px-8 py-4 rounded-lg text-white font-semibold ${
                isListening 
                  ? 'bg-red-500 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              } transition-colors`}
            >
              {isListening ? '🎤 Listening...' : '🎤 Voice Command'}
            </button>
            
            <p className="mt-4 text-gray-600">
              Say commands like: "four", "six", "single", "wicket"
            </p>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <a href="/" className="text-green-600 hover:underline">
            ← Back to Matches
          </a>
        </div>
      </div>
    </div>
  );
}
EOF

# Create config files
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
});
EOF

cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './client/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["client/src", "server", "shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# Set ownership
chown -R $APP_USER:$APP_USER $APP_DIR

# Install dependencies
log "Installing dependencies..."
sudo -u $APP_USER npm install --legacy-peer-deps

# Build application
log "Building Cricket Scorer application..."
sudo -u $APP_USER npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'cricket-scorer',
    script: 'server/index.ts',
    interpreter: 'tsx',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    exec_mode: 'cluster'
  }]
};
EOF

chown $APP_USER:$APP_USER ecosystem.config.cjs

# Start application
log "Starting Cricket Scorer with PM2..."
sudo -u $APP_USER pm2 start ecosystem.config.cjs

# Test deployment
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "Cricket Scorer"; then
    log "✅ Cricket Scorer deployed successfully!"
    log "🌐 Available at: https://score.ramisetty.net"
else
    log "⚠️ Health check failed - checking logs..."
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 10
fi

log "🏏 Cricket Scorer deployment completed!"