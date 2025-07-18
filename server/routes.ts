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
          if (currentMatchId !== null) {
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
          const clients = matchClients.get(currentMatchId);
          if (clients) {
            clients.add(ws);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (currentMatchId !== null) {
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
      
      // Automatically create first innings based on toss decision
      const tossWinnerId = matchData.tossWinnerId ?? matchData.team1Id;
      const battingTeamId = matchData.tossDecision === 'bat' ? tossWinnerId : 
                           tossWinnerId === matchData.team1Id ? matchData.team2Id : matchData.team1Id;
      const bowlingTeamId = battingTeamId === matchData.team1Id ? matchData.team2Id : matchData.team1Id;
      
      // Create first innings
      const innings = await storage.createInnings({
        matchId: match.id,
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

      // Update match status to live
      await storage.updateMatch(match.id, { status: 'live', currentInnings: 1 });

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

      // Update player stats (runs, balls faced, etc.)
      const batterStats = await storage.getPlayerStatsByInnings(ballData.inningsId);
      const batsman = batterStats.find(s => s.playerId === ballData.batsmanId);
      if (batsman) {
        const currentRuns = batsman.runs ?? 0;
        const currentBalls = batsman.ballsFaced ?? 0;
        const currentFours = batsman.fours ?? 0;
        const currentSixes = batsman.sixes ?? 0;
        const ballRuns = ballData.runs ?? 0;
        
        await storage.updatePlayerStats(batsman.id, {
          runs: currentRuns + ballRuns,
          ballsFaced: currentBalls + (ballData.extraType ? 0 : 1),
          fours: ballRuns === 4 ? currentFours + 1 : currentFours,
          sixes: ballRuns === 6 ? currentSixes + 1 : currentSixes,
          isOut: ballData.isWicket ? true : batsman.isOut
        });
      }

      // Update bowler stats
      const bowler = batterStats.find(s => s.playerId === ballData.bowlerId);
      if (bowler) {
        const currentBallsBowled = bowler.ballsBowled ?? 0;
        const currentRunsConceded = bowler.runsConceded ?? 0;
        const currentWickets = bowler.wicketsTaken ?? 0;
        const ballRuns = ballData.runs ?? 0;
        const extraRuns = ballData.extraRuns ?? 0;
        
        await storage.updatePlayerStats(bowler.id, {
          ballsBowled: currentBallsBowled + (ballData.extraType ? 0 : 1),
          runsConceded: currentRunsConceded + ballRuns + extraRuns,
          wicketsTaken: ballData.isWicket ? currentWickets + 1 : currentWickets,
          oversBowled: Math.floor((currentBallsBowled + (ballData.extraType ? 0 : 1)) / 6)
        });
      }

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

  // Advanced scoring endpoints
  app.post('/api/matches/:id/over-complete', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const currentInnings = await storage.getCurrentInnings(matchId);
      
      if (!currentInnings) {
        return res.status(404).json({ error: 'No current innings found' });
      }

      // Logic for handling over completion
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'over_complete', data: liveData });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete over' });
    }
  });

  app.post('/api/matches/:id/change-bowler', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { bowlerId } = req.body;
      
      // Logic for changing bowler
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'bowler_changed', data: liveData });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change bowler' });
    }
  });

  app.post('/api/matches/:id/retire-batsman', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { batsmanId, reason } = req.body;
      
      // Logic for retiring batsman
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'batsman_retired', data: liveData });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retire batsman' });
    }
  });

  return httpServer;
}
