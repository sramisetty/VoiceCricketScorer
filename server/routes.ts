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
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
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
      console.error('Error fetching matches:', error);
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

  app.put('/api/matches/:id', async (req, res) => {
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

  app.delete('/api/matches/:id', async (req, res) => {
    try {
      const matchId = parseInt(req.params.id);
      
      // Reset match status and clear all match data
      await storage.updateMatch(matchId, { 
        status: 'setup', 
        currentInnings: 1 
      });
      
      // Clear all innings, balls, and player stats for this match
      await storage.clearMatchData(matchId);
      
      res.json({ success: true, message: 'Match data cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear match data' });
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

      // Check current innings state before adding ball
      const currentInnings = await storage.getInnings(ballData.inningsId);
      if (!currentInnings) {
        return res.status(400).json({ error: 'Innings not found' });
      }

      // Cricket rule: Maximum 10 wickets can fall (11th player remains not out)
      if (ballData.isWicket && (currentInnings.totalWickets ?? 0) >= 10) {
        return res.status(400).json({ error: 'Cannot record more than 10 wickets in an innings' });
      }

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
          totalWickets: newTotalWickets,
          currentBowlerId: ballData.bowlerId
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

      // Implement cricket strike rotation logic
      await storage.updateStrikeRotation(ballData.inningsId, ballData.batsmanId, ballData.runs ?? 0, ballData.extraType ? true : false);

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

  app.post('/api/matches/:id/timeout', async (req, res) => {
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

  app.post('/api/matches/:id/change-bowler', async (req, res) => {
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

  app.post('/api/matches/:id/set-openers', async (req, res) => {
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
      
      for (const stat of battingTeamStats) {
        await storage.updatePlayerStats(stat.id, { 
          isOnStrike: false,
          ballsFaced: 0 // Reset to 0 for all batsmen
        });
      }
      
      // Set the selected openers - both should be at the crease, but only one is on strike
      const opener1Stats = battingTeamStats.find(stat => stat.playerId === opener1Id);
      const opener2Stats = battingTeamStats.find(stat => stat.playerId === opener2Id);
      
      if (opener1Stats) {
        await storage.updatePlayerStats(opener1Stats.id, { 
          isOnStrike: strikerId === opener1Id
        });
      }
      
      if (opener2Stats) {
        await storage.updatePlayerStats(opener2Stats.id, { 
          isOnStrike: strikerId === opener2Id
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

  app.post('/api/matches/:id/new-batsman', async (req, res) => {
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

  app.post('/api/matches/:id/reset', async (req, res) => {
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

  return httpServer;
}
