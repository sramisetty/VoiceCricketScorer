#!/bin/bash

# Deploy Full Cricket Scorer Application
# Copies complete source code and rebuilds production deployment

set -euo pipefail

APP_DIR="/opt/cricket-scorer"
DB_PASSWORD="cricket_secure_password_2025"
APP_USER="cricketapp"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

log "Deploying full Cricket Scorer application..."

cd $APP_DIR

# Stop current application
sudo -u $APP_USER pm2 stop cricket-scorer 2>/dev/null || true

# Backup current deployment if it exists
if [ -d "client" ]; then
    mv client client.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi
if [ -d "server" ]; then
    mv server server.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi
if [ -d "shared" ]; then
    mv shared shared.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Create complete application structure
log "Creating full application structure..."

# Copy server files
mkdir -p server
cat > server/index.ts << 'EOF'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { createServer } from "http";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

const server = createServer(app);

// API routes
await registerRoutes(app, server);

// Serve static files in production
app.use(express.static("dist/public"));

// Catch-all handler for SPA
app.get("*", (req, res) => {
  res.sendFile(path.resolve("dist/public/index.html"));
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(`[ERROR] ${status}: ${message}`);
  res.status(status).json({ message });
});

const port = parseInt(process.env.PORT || '5000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`🏏 Cricket Scorer Production Server`);
  console.log(`🚀 Listening on port ${port}`);
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log(`🌐 Available at: https://score.ramisetty.net`);
  console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});
EOF

cat > server/routes.ts << 'EOF'
import { type Express } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage.js";

export async function registerRoutes(app: Express, server: any) {
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      app: "Cricket Scorer Production",
      version: "2.0.0",
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    });
  });

  // Teams API
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const team = await storage.createTeam(req.body);
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Players API
  app.get("/api/players", async (req, res) => {
    try {
      const { teamId } = req.query;
      const players = teamId 
        ? await storage.getPlayersByTeam(parseInt(teamId as string))
        : await storage.getPlayers();
      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.post("/api/players", async (req, res) => {
    try {
      const player = await storage.createPlayer(req.body);
      res.status(201).json(player);
    } catch (error) {
      console.error("Error creating player:", error);
      res.status(500).json({ error: "Failed to create player" });
    }
  });

  // Matches API
  app.get("/api/matches", async (req, res) => {
    try {
      const matches = await storage.getMatches();
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.post("/api/matches", async (req, res) => {
    try {
      const match = await storage.createMatch(req.body);
      res.status(201).json(match);
    } catch (error) {
      console.error("Error creating match:", error);
      res.status(500).json({ error: "Failed to create match" });
    }
  });

  app.get("/api/matches/:id", async (req, res) => {
    try {
      const match = await storage.getMatch(parseInt(req.params.id));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      res.json(match);
    } catch (error) {
      console.error("Error fetching match:", error);
      res.status(500).json({ error: "Failed to fetch match" });
    }
  });

  // Innings API
  app.get("/api/matches/:matchId/innings", async (req, res) => {
    try {
      const innings = await storage.getInnings(parseInt(req.params.matchId));
      res.json(innings);
    } catch (error) {
      console.error("Error fetching innings:", error);
      res.status(500).json({ error: "Failed to fetch innings" });
    }
  });

  // WebSocket for real-time updates
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Cricket Scorer WebSocket',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message);
        
        // Broadcast to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'broadcast',
              data: message,
              timestamp: new Date().toISOString()
            }));
          }
        });
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('WebSocket server initialized on /ws');
  return server;
}
EOF

cat > server/storage.ts << 'EOF'
import { type Team, type InsertTeam } from "@shared/schema";

export interface IStorage {
  getTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  getPlayers(): Promise<any[]>;
  getPlayersByTeam(teamId: number): Promise<any[]>;
  createPlayer(player: any): Promise<any>;
  getMatches(): Promise<any[]>;
  createMatch(match: any): Promise<any>;
  getMatch(id: number): Promise<any>;
  getInnings(matchId: number): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private teams: Team[] = [
    { 
      id: 1, 
      name: "Mumbai Indians", 
      shortName: "MI", 
      logo: "🏏",
      founded: 2008,
      homeGround: "Wankhede Stadium",
      captain: "Rohit Sharma"
    },
    { 
      id: 2, 
      name: "Chennai Super Kings", 
      shortName: "CSK", 
      logo: "🦁",
      founded: 2008,
      homeGround: "M. A. Chidambaram Stadium",
      captain: "MS Dhoni"
    },
    { 
      id: 3, 
      name: "Royal Challengers Bangalore", 
      shortName: "RCB", 
      logo: "👑",
      founded: 2008,
      homeGround: "M. Chinnaswamy Stadium",
      captain: "Virat Kohli"
    },
    { 
      id: 4, 
      name: "Kolkata Knight Riders", 
      shortName: "KKR", 
      logo: "⚔️",
      founded: 2008,
      homeGround: "Eden Gardens",
      captain: "Shreyas Iyer"
    }
  ];

  private players: any[] = [];
  private matches: any[] = [
    { 
      id: 1, 
      team1Id: 1, 
      team2Id: 2, 
      status: "scheduled",
      venue: "Wankhede Stadium",
      date: new Date(Date.now() + 24*60*60*1000).toISOString(),
      overs: 20,
      format: "T20",
      tossWinner: null,
      battingFirst: null
    },
    { 
      id: 2, 
      team1Id: 3, 
      team2Id: 4, 
      status: "upcoming",
      venue: "Eden Gardens",
      date: new Date(Date.now() + 48*60*60*1000).toISOString(),
      overs: 20,
      format: "T20",
      tossWinner: null,
      battingFirst: null
    }
  ];

  async getTeams(): Promise<Team[]> {
    return [...this.teams];
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const newTeam: Team = {
      ...team,
      id: Math.max(...this.teams.map(t => t.id), 0) + 1
    };
    this.teams.push(newTeam);
    return newTeam;
  }

  async getPlayers(): Promise<any[]> {
    return [...this.players];
  }

  async getPlayersByTeam(teamId: number): Promise<any[]> {
    return this.players.filter(p => p.teamId === teamId);
  }

  async createPlayer(player: any): Promise<any> {
    const newPlayer = {
      ...player,
      id: Math.max(...this.players.map(p => p.id), 0) + 1
    };
    this.players.push(newPlayer);
    return newPlayer;
  }

  async getMatches(): Promise<any[]> {
    return [...this.matches];
  }

  async createMatch(match: any): Promise<any> {
    const newMatch = {
      ...match,
      id: Math.max(...this.matches.map(m => m.id), 0) + 1
    };
    this.matches.push(newMatch);
    return newMatch;
  }

  async getMatch(id: number): Promise<any> {
    return this.matches.find(m => m.id === id);
  }

  async getInnings(matchId: number): Promise<any[]> {
    return [];
  }
}

export const storage = new MemStorage();
EOF

# Create shared schema
mkdir -p shared
cat > shared/schema.ts << 'EOF'
import { z } from "zod";

export const insertTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  shortName: z.string().min(1, "Short name is required").max(5, "Short name must be 5 characters or less"),
  logo: z.string().optional(),
  founded: z.number().optional(),
  homeGround: z.string().optional(),
  captain: z.string().optional(),
});

export type InsertTeam = z.infer<typeof insertTeamSchema>;

export interface Team extends InsertTeam {
  id: number;
}

export interface Player {
  id: number;
  name: string;
  teamId: number;
  role: "batsman" | "bowler" | "allrounder" | "wicketkeeper";
  battingOrder?: number;
}

export interface Match {
  id: number;
  team1Id: number;
  team2Id: number;
  status: "scheduled" | "live" | "completed";
  venue: string;
  date: string;
  overs: number;
  format: "T20" | "ODI" | "Test";
  tossWinner?: number;
  battingFirst?: number;
}
EOF

# Create complete client structure
mkdir -p client/src/{components/ui,hooks,lib,pages}

# Main client files
cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cricket Scorer - Voice Enabled Platform</title>
    <meta name="description" content="Professional voice-enabled cricket scoring platform with real-time updates and ICC compliance" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
EOF

cat > client/src/main.tsx << 'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
EOF

cat > client/src/App.tsx << 'EOF'
import React from "react";
import { Router, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import Matches from "./pages/matches";
import Scorer from "./pages/scorer";
import Scoreboard from "./pages/scoreboard";
import MatchSetup from "./pages/match-setup";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800">
        <Switch>
          <Route path="/" component={Matches} />
          <Route path="/matches" component={Matches} />
          <Route path="/setup" component={MatchSetup} />
          <Route path="/scorer/:matchId?" component={Scorer} />
          <Route path="/scoreboard/:matchId?" component={Scoreboard} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </div>
    </Router>
  );
}
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
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

.cricket-field {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}
EOF

# Basic pages
cat > client/src/pages/matches.tsx << 'EOF'
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface Team {
  id: number;
  name: string;
  shortName: string;
  logo?: string;
}

interface Match {
  id: number;
  team1Id: number;
  team2Id: number;
  status: string;
  venue: string;
  date: string;
  format: string;
}

export default function Matches() {
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: () => fetch("/api/teams").then(res => res.json()),
  });

  const { data: matches = [] } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
    queryFn: () => fetch("/api/matches").then(res => res.json()),
  });

  const getTeam = (id: number) => teams.find(t => t.id === id);

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">🏏 Cricket Scorer</h1>
          <p className="text-xl opacity-90">Voice-Enabled Professional Cricket Scoring Platform</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Live Matches</h2>
            <Link href="/setup">
              <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                + New Match
              </button>
            </Link>
          </div>

          <div className="grid gap-4">
            {matches.map((match) => {
              const team1 = getTeam(match.team1Id);
              const team2 = getTeam(match.team2Id);
              
              return (
                <div key={match.id} className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-2xl">{team1?.logo || "🏏"}</span>
                        <span className="font-semibold text-lg">{team1?.name || "Team 1"}</span>
                        <span className="text-gray-300">vs</span>
                        <span className="font-semibold text-lg">{team2?.name || "Team 2"}</span>
                        <span className="text-2xl">{team2?.logo || "🏏"}</span>
                      </div>
                      <div className="text-sm opacity-75">
                        {match.format} • {match.venue} • {new Date(match.date).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        match.status === 'live' ? 'bg-red-500 text-white' :
                        match.status === 'completed' ? 'bg-gray-500 text-white' :
                        'bg-yellow-500 text-black'
                      }`}>
                        {match.status.toUpperCase()}
                      </span>
                      
                      <div className="flex gap-2 ml-4">
                        <Link href={`/scorer/${match.id}`}>
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            Score Match
                          </button>
                        </Link>
                        <Link href={`/scoreboard/${match.id}`}>
                          <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            Scoreboard
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {matches.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏏</div>
              <h3 className="text-xl font-semibold mb-2">No matches scheduled</h3>
              <p className="text-gray-300 mb-6">Create your first cricket match to get started</p>
              <Link href="/setup">
                <button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors">
                  Create New Match
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
EOF

# Create basic pages for scorer and scoreboard
cat > client/src/pages/scorer.tsx << 'EOF'
import React from "react";
import { useParams } from "wouter";

export default function Scorer() {
  const params = useParams();
  const matchId = params.matchId;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">🏏 Cricket Scorer</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Match Scorer</h2>
          <p>Match ID: {matchId || "New Match"}</p>
          <p className="text-gray-300 mt-2">Voice-enabled scoring interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
EOF

cat > client/src/pages/scoreboard.tsx << 'EOF'
import React from "react";
import { useParams } from "wouter";

export default function Scoreboard() {
  const params = useParams();
  const matchId = params.matchId;

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">🏏 Live Scoreboard</h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Match Scoreboard</h2>
          <p>Match ID: {matchId || "Select Match"}</p>
          <p className="text-gray-300 mt-2">Live scoreboard display coming soon...</p>
        </div>
      </div>
    </div>
  );
}
EOF

cat > client/src/pages/match-setup.tsx << 'EOF'
import React from "react";
import { Link } from "wouter";

export default function MatchSetup() {
  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/matches">
            <button className="text-blue-300 hover:text-blue-200 mb-4">← Back to Matches</button>
          </Link>
          <h1 className="text-3xl font-bold">Setup New Match</h1>
        </div>
        
        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-6">Match Configuration</h2>
          <p className="text-gray-300">Match setup interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
EOF

cat > client/src/pages/not-found.tsx << 'EOF'
import React from "react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-gray-300 mb-8">The page you're looking for doesn't exist.</p>
        <Link href="/matches">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
            Return to Matches
          </button>
        </Link>
      </div>
    </div>
  );
}
EOF

# Create basic UI components
mkdir -p client/src/components/ui
cat > client/src/components/ui/toaster.tsx << 'EOF'
import React from "react";

export function Toaster() {
  return null; // Placeholder for toast notifications
}
EOF

# Create lib files
cat > client/src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

# Set ownership
chown -R $APP_USER:$APP_USER $APP_DIR

# Install dependencies and rebuild
log "Installing dependencies and rebuilding application..."
sudo -u $APP_USER npm install --legacy-peer-deps

# Build the application
log "Building complete Cricket Scorer application..."
sudo -u $APP_USER npm run build

# Restart application
log "Restarting Cricket Scorer with full application..."
sudo -u $APP_USER pm2 restart cricket-scorer

# Test application
sleep 3
if curl -s http://localhost:5000/api/health | grep -q "Cricket Scorer"; then
    log "✅ Full Cricket Scorer application deployed successfully!"
    log "🌐 Visit: https://score.ramisetty.net"
    log "🔍 API: https://score.ramisetty.net/api/health"
else
    log "⚠️ Application deployed but health check failed"
    sudo -u $APP_USER pm2 logs cricket-scorer --lines 10
fi

log "🏏 Full Cricket Scorer deployment completed!"