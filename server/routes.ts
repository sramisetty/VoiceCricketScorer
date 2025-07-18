import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMatchSchema, insertTeamSchema, insertPlayerSchema, insertBallSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients by match ID
  const matchClients = new Map<number, Set<WebSocket>>();

  wss.on('connection', (ws) => {
    let currentMatchId: number | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'join_match' && typeof message.matchId === 'number') {
          // Leave previous match if any
          if (currentMatchId) {
            const clients = matchClients.get(currentMatchId);
            if (clients) {
              clients.delete(ws);
              if (clients.size === 0) {
                matchClients.delete(currentMatchId);
              }
            }
          }

          // Join new match
          currentMatchId = message.matchId;
          if (!matchClients.has(currentMatchId)) {
            matchClients.set(currentMatchId, new Set());
          }
          matchClients.get(currentMatchId)!.add(ws);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (currentMatchId) {
        const clients = matchClients.get(currentMatchId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            matchClients.delete(currentMatchId);
          }
        }
      }
    });
  });

  // Broadcast to all clients watching a match
  function broadcastToMatch(matchId: number, data: any) {
    const clients = matchClients.get(matchId);
    if (clients) {
      const message = JSON.stringify(data);
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  // Teams API
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  });

  app.post('/api/teams', async (req, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData);
      res.json(team);
    } catch (error) {
      res.status(400).json({ error: 'Invalid team data' });
    }
  });

  app.get('/api/teams/:id/players', async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const players = await storage.getPlayersByTeam(teamId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });

  // Players API
  app.post('/api/players', async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer(playerData);
      res.json(player);
    } catch (error) {
      res.status(400).json({ error: 'Invalid player data' });
    }
  });

  // Matches API
  app.get('/api/matches', async (req, res) => {
    try {
      const matches = await storage.getAllMatches();
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch matches' });
    }
  });

  app.post('/api/matches', async (req, res) => {
    try {
      const matchData = insertMatchSchema.parse(req.body);
      const match = await storage.createMatch(matchData);
      res.json(match);
    } catch (error) {
      res.status(400).json({ error: 'Invalid match data' });
    }
  });

  app.get('/api/matches/:id', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const match = await storage.getMatchWithTeams(matchId);
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      res.json(match);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch match' });
    }
  });

  app.get('/api/matches/:id/live', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const liveData = await storage.getLiveMatchData(matchId);
      if (!liveData) {
        return res.status(404).json({ error: 'Live data not found' });
      }
      res.json(liveData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch live data' });
    }
  });

  app.post('/api/matches/:id/start', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { battingTeamId, bowlingTeamId } = req.body;

      // Create first innings
      const innings = await storage.createInnings({
        matchId,
        battingTeamId,
        bowlingTeamId,
        inningsNumber: 1,
        totalRuns: 0,
        totalWickets: 0,
        totalOvers: 0,
        totalBalls: 0,
        extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
        isCompleted: false
      });

      // Update match status
      await storage.updateMatch(matchId, { status: 'live' });

      // Initialize player stats for batting team
      const battingPlayers = await storage.getPlayersByTeam(battingTeamId);
      for (const player of battingPlayers) {
        await storage.createPlayerStats({
          inningsId: innings.id,
          playerId: player.id,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
          isOnStrike: false,
          oversBowled: 0,
          ballsBowled: 0,
          runsConceded: 0,
          wicketsTaken: 0
        });
      }

      // Initialize player stats for bowling team
      const bowlingPlayers = await storage.getPlayersByTeam(bowlingTeamId);
      for (const player of bowlingPlayers) {
        await storage.createPlayerStats({
          inningsId: innings.id,
          playerId: player.id,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
          isOnStrike: false,
          oversBowled: 0,
          ballsBowled: 0,
          runsConceded: 0,
          wicketsTaken: 0
        });
      }

      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'match_started', data: liveData });

      res.json({ success: true, innings });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start match' });
    }
  });

  // Scoring API
  app.post('/api/matches/:id/ball', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const ballData = insertBallSchema.parse(req.body);

      const ball = await storage.createBall(ballData);

      // Update innings totals
      const innings = await storage.getInnings(ballData.inningsId);
      if (innings) {
        const currentRuns = innings.totalRuns ?? 0;
        const currentBalls = innings.totalBalls ?? 0;
        const currentWickets = innings.totalWickets ?? 0;
        const ballRuns = ballData.runs ?? 0;
        const extraRuns = ballData.extraRuns ?? 0;
        
        const newTotalRuns = currentRuns + ballRuns + extraRuns;
        const newTotalBalls = ballData.extraType ? currentBalls : currentBalls + 1;
        const newTotalOvers = Math.floor(newTotalBalls / 6);
        const newTotalWickets = (ballData.isWicket ?? false) ? currentWickets + 1 : currentWickets;

        await storage.updateInnings(ballData.inningsId, {
          totalRuns: newTotalRuns,
          totalBalls: newTotalBalls,
          totalOvers: newTotalOvers,
          totalWickets: newTotalWickets
        });
      }

      // Update player stats
      // ... (complex logic for updating batsman and bowler stats)

      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'ball_update', data: liveData });

      res.json(ball);
    } catch (error) {
      res.status(400).json({ error: 'Invalid ball data' });
    }
  });

  app.post('/api/matches/:id/undo', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const currentInnings = await storage.getCurrentInnings(matchId);
      
      if (!currentInnings) {
        return res.status(404).json({ error: 'No current innings found' });
      }

      const success = await storage.undoLastBall(currentInnings.id);
      
      if (success) {
        const liveData = await storage.getLiveMatchData(matchId);
        broadcastToMatch(matchId, { type: 'ball_undone', data: liveData });
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'No balls to undo' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to undo ball' });
    }
  });

  return httpServer;
}
