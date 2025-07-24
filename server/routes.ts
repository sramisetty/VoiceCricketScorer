import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertFranchiseSchema, insertMatchSchema, insertTeamSchema, insertPlayerSchema, insertBallSchema } from "@shared/schema";
import { transcribeAudio, validateAudioFormat } from "./whisper";
import { optionalAuth, AuthenticatedRequest, authenticateToken, requireRole } from "./auth";
import authRoutes from "./authRoutes";
import playerRoutes from "./playerRoutes";
import { registerStatsRoutes } from "./statsRoutes";
import multer from "multer";

// Configure multer for in-memory storage - accept all files, validate later
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Register authentication and player management routes
  app.use('/api', authRoutes);
  app.use('/api', playerRoutes);
  
  // Register statistics routes
  registerStatsRoutes(app);

  // Franchise Management API routes
  app.get('/api/franchises', async (req, res) => {
    try {
      const franchises = await storage.getAllFranchises();
      res.json(franchises);
    } catch (error) {
      console.error("Error fetching franchises:", error);
      res.status(500).json({ message: "Failed to fetch franchises" });
    }
  });

  app.post('/api/franchises', authenticateToken, requireRole(['global_admin']), async (req: any, res) => {
    try {
      const franchiseData = insertFranchiseSchema.parse(req.body);
      const franchise = await storage.createFranchise(franchiseData);
      res.status(201).json(franchise);
    } catch (error) {
      console.error("Error creating franchise:", error);
      res.status(500).json({ message: "Failed to create franchise" });
    }
  });

  app.get('/api/franchises/:id', async (req, res) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const franchise = await storage.getFranchise(franchiseId);
      
      if (!franchise) {
        return res.status(404).json({ message: "Franchise not found" });
      }
      
      res.json(franchise);
    } catch (error) {
      console.error("Error fetching franchise:", error);
      res.status(500).json({ message: "Failed to fetch franchise" });
    }
  });

  app.put('/api/franchises/:id', authenticateToken, requireRole(['global_admin']), async (req: any, res) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const updateData = req.body;
      const updatedFranchise = await storage.updateFranchise(franchiseId, updateData);
      
      if (!updatedFranchise) {
        return res.status(404).json({ message: "Franchise not found" });
      }
      
      res.json(updatedFranchise);
    } catch (error) {
      console.error("Error updating franchise:", error);
      res.status(500).json({ message: "Failed to update franchise" });
    }
  });

  app.get('/api/franchises/:id/users', authenticateToken, requireRole(['global_admin', 'franchise_admin']), async (req: any, res) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const users = await storage.getFranchiseUsers(franchiseId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching franchise users:", error);
      res.status(500).json({ message: "Failed to fetch franchise users" });
    }
  });

  app.get('/api/franchises/:id/teams', async (req, res) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const teams = await storage.getFranchiseTeams(franchiseId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching franchise teams:", error);
      res.status(500).json({ message: "Failed to fetch franchise teams" });
    }
  });

  app.get('/api/franchises/:id/players', async (req, res) => {
    try {
      const franchiseId = parseInt(req.params.id);
      const players = await storage.getFranchisePlayers(franchiseId);
      res.json(players);
    } catch (error) {
      console.error("Error fetching franchise players:", error);
      res.status(500).json({ message: "Failed to fetch franchise players" });
    }
  });

  // User Management API routes (require authentication)
  app.get('/api/users', authenticateToken, requireRole(['admin', 'coach']), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updateData = req.body;
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or failed to delete" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.put('/api/users/:id/link-player', authenticateToken, requireRole(['admin', 'coach']), async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { playerId } = req.body;
      const updatedUser = await storage.linkUserToPlayer(userId, playerId);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found or failed to link" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error linking user to player:", error);
      res.status(500).json({ message: "Failed to link user to player" });
    }
  });

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
          const matchId = message.matchId as number;
          currentMatchId = matchId;
          if (!matchClients.has(matchId)) {
            matchClients.set(matchId, new Set());
          }
          const clients = matchClients.get(matchId);
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
      console.log('Successfully fetched teams:', teams.length);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: 'Failed to fetch teams', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/teams', async (req, res) => {
    try {
      console.log('Received team data:', req.body);
      const teamData = insertTeamSchema.parse(req.body);
      console.log('Parsed team data:', teamData);
      const team = await storage.createTeam(teamData);
      console.log('Created team:', team);
      res.json(team);
    } catch (error) {
      console.error('Team validation error:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: 'Invalid team data', details: error.message });
      } else {
        res.status(400).json({ error: 'Invalid team data' });
      }
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

  // Matches API (enhanced with authentication)
  app.get('/api/matches', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const matches = await storage.getAllMatches();
      res.json(matches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      res.status(500).json({ error: 'Failed to fetch matches' });
    }
  });

  app.post('/api/matches', optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const matchData = insertMatchSchema.parse(req.body);
      // If user is authenticated, set them as the creator
      const finalMatchData = req.user 
        ? { ...matchData, createdBy: req.user.id }
        : { ...matchData, createdBy: 1 }; // Default admin user for non-authenticated users
      
      const match = await storage.createMatch(finalMatchData);
      
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

  app.put('/api/matches/:id', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const updateData = req.body;
      
      const match = await storage.updateMatch(matchId, updateData);
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      res.json(match);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update match' });
    }
  });

  app.delete('/api/matches/:id', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      
      // Completely delete the match and all related data
      const deleted = await storage.deleteMatch(matchId);
      
      if (!deleted) {
        return res.status(400).json({ error: 'Failed to delete match' });
      }
      
      res.json({ success: true, message: 'Match and all related data deleted successfully' });
    } catch (error) {
      console.error('Error deleting match:', error);
      res.status(500).json({ error: 'Failed to delete match' });
    }
  });

  app.post('/api/matches/:id/start', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
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

  // Scoring API (require admin or scorer role)
  app.post('/api/matches/:id/ball', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const ballData = insertBallSchema.parse(req.body);

      // Check current innings state before adding ball
      const currentInnings = await storage.getInnings(ballData.inningsId);
      if (!currentInnings) {
        return res.status(400).json({ error: 'Innings not found' });
      }

      // Cricket rule: Maximum 10 wickets can fall (11th player remains not out)
      if (ballData.isWicket && (currentInnings.totalWickets ?? 0) >= 10) {
        return res.status(400).json({ error: 'Cannot record more than 10 wickets in an innings' });
      }

      // Create and save the ball (this will validate consecutive bowling rule)
      try {
        var ball = await storage.createBall(ballData);
      } catch (error) {
        if (error.message.includes('Cricket Rule Violation')) {
          return res.status(400).json({ error: error.message });
        }
        throw error; // Re-throw if it's not a cricket rule violation
      }

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
          totalWickets: newTotalWickets,
          currentBowlerId: ballData.bowlerId
        });
      }

      // Update player statistics with ICC compliance
      const totalRunsScored = (ballData.runs ?? 0) + (ballData.extraRuns ?? 0);
      const isValidBall = !ballData.extraType || ballData.extraType === 'bye' || ballData.extraType === 'legbye';
      const isExtra = ballData.extraType && ['wide', 'noball'].includes(ballData.extraType);
      
      await storage.updateBatsmanStatsWithICCRules(ballData.inningsId, ballData.batsmanId, ballData.runs ?? 0, isValidBall, ballData.isWicket ?? false, ballData.extraType);
      await storage.updateBowlerStatsWithICCRules(ballData.inningsId, ballData.bowlerId, totalRunsScored, isValidBall, ballData.isWicket ?? false, ballData.extraType);
      
      // Handle strike rotation with ICC rules
      await storage.updateStrikeRotation(ballData.inningsId, ballData.batsmanId, ballData.runs ?? 0, !!isExtra);

      // Check for innings completion and handle second innings
      const updatedInnings = await storage.getInnings(ballData.inningsId);
      const match = await storage.getMatch(matchId);
      
      if (updatedInnings && match) {
        const totalOvers = match.overs;
        const totalWickets = updatedInnings.totalWickets ?? 0;
        const currentBalls = updatedInnings.totalBalls ?? 0;
        const isInningsComplete = totalWickets >= 10 || currentBalls >= (totalOvers * 6);
        
        if (isInningsComplete && !updatedInnings.isCompleted) {
          // Mark current innings as completed
          await storage.updateInnings(ballData.inningsId, { isCompleted: true });
          
          // Check if this is first innings and start second innings
          if (updatedInnings.inningsNumber === 1) {
            const secondInnings = await storage.createInnings({
              matchId,
              battingTeamId: updatedInnings.bowlingTeamId, // Teams swap
              bowlingTeamId: updatedInnings.battingTeamId,
              inningsNumber: 2,
              totalRuns: 0,
              totalWickets: 0,
              totalOvers: 0,
              totalBalls: 0,
              extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
              isCompleted: false
            });

            // Update match to second innings
            await storage.updateMatch(matchId, { currentInnings: 2 });

            // Initialize player stats for new innings
            const newBattingPlayers = await storage.getPlayersByTeam(updatedInnings.bowlingTeamId);
            const newBowlingPlayers = await storage.getPlayersByTeam(updatedInnings.battingTeamId);
            
            for (const player of [...newBattingPlayers, ...newBowlingPlayers]) {
              await storage.createPlayerStats({
                inningsId: secondInnings.id,
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

            broadcastToMatch(matchId, { 
              type: 'innings_complete', 
              data: { 
                completedInnings: updatedInnings.inningsNumber,
                newInnings: secondInnings 
              } 
            });
          } else {
            // Second innings completed - match finished
            await storage.updateMatch(matchId, { status: 'completed' });
            broadcastToMatch(matchId, { 
              type: 'match_complete', 
              data: { matchId } 
            });
          }
        }
      }

      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'ball_update', data: liveData });

      res.json(ball);
    } catch (error) {
      res.status(400).json({ error: 'Invalid ball data' });
    }
  });

  app.post('/api/matches/:id/undo', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
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

  // Clear all balls and runs for a match (require admin or scorer role)
  app.post('/api/matches/:id/clear', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const success = await storage.clearMatchData(matchId);
      
      if (success) {
        const liveData = await storage.getLiveMatchData(matchId);
        broadcastToMatch(matchId, { type: 'match_cleared', data: liveData });
        res.json({ success: true, message: 'Match data cleared successfully' });
      } else {
        res.status(400).json({ error: 'Failed to clear match data' });
      }
    } catch (error) {
      console.error('Clear match error:', error);
      res.status(500).json({ error: 'Failed to clear match data' });
    }
  });

  // Advanced scoring endpoints (require admin or scorer role)
  app.post('/api/matches/:id/over-complete', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
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

  app.post('/api/matches/:id/change-bowler', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { newBowlerId } = req.body;
      
      if (!newBowlerId) {
        return res.status(400).json({ error: 'newBowlerId is required' });
      }
      
      const currentInnings = await storage.getCurrentInnings(matchId);
      if (!currentInnings) {
        return res.status(404).json({ error: 'No current innings found' });
      }
      
      // Get the player stats for this innings
      const playerStats = await storage.getPlayerStatsByInnings(currentInnings.id);
      
      // Find the new bowler's stats
      const newBowlerStats = playerStats.find(s => s.playerId === newBowlerId);
      if (!newBowlerStats) {
        return res.status(400).json({ error: 'Bowler not found in this match' });
      }
      
      // Check if the new bowler is from the bowling team
      if (newBowlerStats.player.teamId !== currentInnings.bowlingTeam.id) {
        return res.status(400).json({ error: 'Player is not from the bowling team' });
      }
      
      // Check cricket rule: same bowler cannot bowl consecutive overs
      try {
        // Get current over number
        const totalBalls = currentInnings.totalBalls ?? 0;
        const currentOver = Math.floor(totalBalls / 6) + 1;
        
        // Validate consecutive bowling rule using ICC rules engine
        const validation = await storage.validateBallWithICCRules({
          inningsId: currentInnings.id,
          bowlerId: newBowlerId,
          overNumber: currentOver,
          ballNumber: 1,
          batsmanId: 0, // Placeholder for validation
          runs: 0
        }, currentInnings.id);
        
        if (!validation.isValid) {
          throw new Error(validation.errorMessage || "ICC Cricket Rule Violation");
        }
      } catch (error) {
        if (error.message.includes('Cricket Rule Violation')) {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }
      
      // Initialize the new bowler if they haven't bowled yet
      if ((newBowlerStats.ballsBowled ?? 0) === 0) {
        await storage.updatePlayerStats(newBowlerStats.id, {
          ballsBowled: 0,
          runsConceded: 0,
          wicketsTaken: 0,
          oversBowled: 0
        });
      }
      
      // Update innings to track the current bowler
      await storage.updateInnings(currentInnings.id, {
        currentBowlerId: newBowlerId
      });
      
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'bowler_changed', data: liveData });
      
      res.json({ success: true, newBowlerId });
    } catch (error) {
      console.error('Error changing bowler:', error);
      res.status(500).json({ error: 'Failed to change bowler' });
    }
  });

  app.post('/api/matches/:id/timeout', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { duration } = req.body;
      
      // Update match status to indicate timeout
      await storage.updateMatch(matchId, { 
        status: 'timeout'
      });
      
      // Set timeout to resume match after duration
      setTimeout(async () => {
        await storage.updateMatch(matchId, { status: 'live' });
        const liveData = await storage.getLiveMatchData(matchId);
        broadcastToMatch(matchId, { type: 'timeout_ended', data: liveData });
      }, duration * 60 * 1000); // Convert minutes to milliseconds
      
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'timeout_started', data: liveData });
      
      res.json({ success: true, duration });
    } catch (error) {
      res.status(500).json({ error: 'Failed to call timeout' });
    }
  });

  app.post('/api/matches/:id/retire-batsman', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
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

  app.post('/api/matches/:id/change-bowler-alt', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { newBowlerId } = req.body;
      
      if (!newBowlerId) {
        return res.status(400).json({ error: 'newBowlerId is required' });
      }
      
      // Get current match data
      const liveData = await storage.getLiveMatchData(matchId);
      if (!liveData) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      // Update the current bowler - simply set as active bowler
      // In cricket, the bowler change is handled by the scoring system
      
      const updatedLiveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'bowler_changed', data: updatedLiveData });
      
      res.json({ success: true, newBowlerId });
    } catch (error) {
      console.error('Error changing bowler:', error);
      res.status(500).json({ error: 'Failed to change bowler' });
    }
  });

  app.post('/api/matches/:id/set-openers', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { opener1Id, opener2Id, strikerId } = req.body;
      
      if (!opener1Id || !opener2Id || !strikerId) {
        return res.status(400).json({ error: 'opener1Id, opener2Id, and strikerId are required' });
      }
      
      if (opener1Id === opener2Id) {
        return res.status(400).json({ error: 'Both openers cannot be the same player' });
      }
      
      if (strikerId !== opener1Id && strikerId !== opener2Id) {
        return res.status(400).json({ error: 'Striker must be one of the selected openers' });
      }
      
      // Get current match data
      const liveData = await storage.getLiveMatchData(matchId);
      if (!liveData) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      // Clear existing batsmen on strike status and reset ballsFaced for all batsmen
      const currentInnings = liveData.currentInnings;
      const battingTeamStats = currentInnings.playerStats.filter(
        stat => stat.player.teamId === currentInnings.battingTeam.id
      );
      
      // First, reset all batsmen to false strike status and ballsFaced to 0
      for (const stat of battingTeamStats) {
        await storage.updatePlayerStats(stat.id, { 
          isOnStrike: false,
          ballsFaced: 0 // Reset to 0 for all batsmen
        });
      }
      
      // Set the selected openers - use temporary ballsFaced marker to distinguish selected openers
      const opener1Stats = battingTeamStats.find(stat => stat.playerId === opener1Id);
      const opener2Stats = battingTeamStats.find(stat => stat.playerId === opener2Id);
      
      if (opener1Stats) {
        await storage.updatePlayerStats(opener1Stats.id, { 
          isOnStrike: strikerId === opener1Id,
          ballsFaced: -1 // Use -1 as temporary marker for selected openers
        });
      }
      
      if (opener2Stats) {
        await storage.updatePlayerStats(opener2Stats.id, { 
          isOnStrike: strikerId === opener2Id,
          ballsFaced: -1 // Use -1 as temporary marker for selected openers
        });
      }
      
      const updatedLiveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'openers_set', data: updatedLiveData });
      
      res.json({ success: true, opener1Id, opener2Id, strikerId });
    } catch (error) {
      console.error('Error setting openers:', error);
      res.status(500).json({ error: 'Failed to set openers' });
    }
  });

  app.post('/api/matches/:id/switch-strike', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      
      // Get current match data
      const liveData = await storage.getLiveMatchData(matchId);
      if (!liveData) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const currentBatsmen = liveData.currentBatsmen;
      if (currentBatsmen.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 batsmen to switch strike' });
      }
      
      // Find current striker and non-striker
      const currentStriker = currentBatsmen.find(b => b.isOnStrike);
      const currentNonStriker = currentBatsmen.find(b => !b.isOnStrike);
      
      if (!currentStriker || !currentNonStriker) {
        return res.status(400).json({ error: 'Could not identify current batsmen for strike switch' });
      }
      
      // Switch the strike
      await storage.updatePlayerStats(currentStriker.id, { isOnStrike: false });
      await storage.updatePlayerStats(currentNonStriker.id, { isOnStrike: true });
      
      console.log(`Manual strike switch: ${currentNonStriker.player.name} is now on strike (was ${currentStriker.player.name})`);
      
      const updatedLiveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'strike_switched', data: updatedLiveData });
      
      res.json({ 
        success: true, 
        previousStriker: currentStriker.player.name,
        newStriker: currentNonStriker.player.name
      });
    } catch (error) {
      console.error('Error switching strike:', error);
      res.status(500).json({ error: 'Failed to switch strike' });
    }
  });

  app.post('/api/matches/:id/new-batsman', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      const { newBatsmanId } = req.body;
      
      if (!newBatsmanId) {
        return res.status(400).json({ error: 'newBatsmanId is required' });
      }
      
      // Get current match data
      const liveData = await storage.getLiveMatchData(matchId);
      if (!liveData) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const currentInnings = liveData.currentInnings;
      const battingTeamStats = currentInnings.playerStats.filter(
        stat => stat.player.teamId === currentInnings.battingTeam.id
      );
      
      // Check if the new batsman is valid (not already out, not currently batting)
      const newBatsmanStats = battingTeamStats.find(stat => stat.playerId === newBatsmanId);
      if (newBatsmanStats && newBatsmanStats.isOut) {
        return res.status(400).json({ error: 'Selected batsman is already out' });
      }
      
      const isCurrentlyBatting = liveData.currentBatsmen.some(batsman => batsman.playerId === newBatsmanId);
      if (isCurrentlyBatting) {
        return res.status(400).json({ error: 'Selected batsman is already batting' });
      }
      
      // Initialize stats for the new batsman if they don't exist
      if (!newBatsmanStats) {
        // Create player stats for the new batsman
        await storage.createPlayerStats({
          inningsId: currentInnings.id,
          playerId: newBatsmanId,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
          isOnStrike: false
        });
      } else {
        // Reset their out status if they were marked as out
        await storage.updatePlayerStats(newBatsmanStats.id, { 
          isOut: false,
          isOnStrike: false 
        });
      }
      
      const updatedLiveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'new_batsman_added', data: updatedLiveData });
      
      res.json({ success: true, newBatsmanId });
    } catch (error) {
      console.error('Error adding new batsman:', error);
      res.status(500).json({ error: 'Failed to add new batsman' });
    }
  });

  app.post('/api/matches/:id/reset', authenticateToken, requireRole(['admin', 'scorer']), async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      await storage.resetMatchData(matchId);
      
      const liveData = await storage.getLiveMatchData(matchId);
      broadcastToMatch(matchId, { type: 'match_reset', data: liveData });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset match data' });
    }
  });

  // Audio transcription endpoint for improved speech recognition (require admin or scorer role)
  app.post('/api/transcribe-audio', authenticateToken, requireRole(['admin', 'scorer']), upload.single('audio'), async (req, res) => {
    try {
      console.log("Received transcription request");
      console.log("Request file:", req.file ? `${req.file.originalname} (${req.file.size} bytes)` : "No file");
      
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const audioBuffer = req.file.buffer;
      console.log("Audio buffer size:", audioBuffer.length);
      
      // Validate audio format
      if (!validateAudioFormat(audioBuffer)) {
        console.log("Invalid audio format detected");
        return res.status(400).json({ error: 'Invalid audio format' });
      }

      console.log("Audio format validation passed");

      // Transcribe audio using OpenAI Whisper
      const result = await transcribeAudio(audioBuffer, req.file.originalname);
      
      console.log("Transcription successful:", result);
      
      res.json({
        success: true,
        transcript: result.text,
        confidence: result.confidence
      });
    } catch (error: any) {
      console.error('Audio transcription error:', error);
      res.status(500).json({ error: `Failed to transcribe audio: ${error.message}` });
    }
  });

  return httpServer;
}
