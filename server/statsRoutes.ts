import type { Express } from "express";
import { storage } from "./storage";

export function registerStatsRoutes(app: Express) {
  
  // Match Statistics Routes
  app.get('/api/matches/stats', async (req, res) => {
    try {
      const { matchId, timeRange } = req.query;
      const stats = await storage.getMatchStatistics(
        matchId ? parseInt(matchId as string) : null,
        timeRange as string || 'all'
      );
      res.json(stats);
    } catch (error) {
      console.error('Error fetching match statistics:', error);
      res.status(500).json({ message: 'Failed to fetch match statistics' });
    }
  });

  // Archived Matches Routes
  app.get('/api/matches/archived', async (req, res) => {
    try {
      const { search, status, sort } = req.query;
      const archivedMatches = await storage.getArchivedMatches({
        search: search as string,
        status: status as string,
        sort: sort as string
      });
      res.json(archivedMatches);
    } catch (error) {
      console.error('Error fetching archived matches:', error);
      res.status(500).json({ message: 'Failed to fetch archived matches' });
    }
  });

  // Export Match Data
  app.get('/api/matches/:matchId/export', async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const exportData = await storage.exportMatchData(matchId);
      res.json(exportData);
    } catch (error) {
      console.error('Error exporting match data:', error);
      res.status(500).json({ message: 'Failed to export match data' });
    }
  });

  // Player Statistics Routes  
  app.get('/api/player-statistics', async (req, res) => {
    try {
      const { search, franchise, role } = req.query;
      const playerStats = await storage.getPlayerStatistics({
        search: search as string,
        franchise: franchise as string,
        role: role as string
      });
      res.json(playerStats);
    } catch (error) {
      console.error('Error fetching player statistics:', error);
      res.status(500).json({ message: 'Failed to fetch player statistics' });
    }
  });

  // All Player Statistics (for simplified endpoint)
  app.get('/api/player-statistics/:franchise/:role', async (req, res) => {
    try {
      const { franchise, role } = req.params;
      const playerStats = await storage.getPlayerStatistics({
        search: '',
        franchise: franchise === 'all' ? 'all' : franchise,
        role: role === 'all' ? 'all' : role
      });
      res.json(playerStats);
    } catch (error) {
      console.error('Error fetching player statistics:', error);
      res.status(500).json({ message: 'Failed to fetch player statistics' });
    }
  });

  // Detailed Player Statistics
  app.get('/api/players/:playerId/detailed-stats', async (req, res) => {
    try {
      const playerId = parseInt(req.params.playerId);
      const detailedStats = await storage.getDetailedPlayerStats(playerId);
      
      if (!detailedStats) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      res.json(detailedStats);
    } catch (error) {
      console.error('Error fetching detailed player statistics:', error);
      res.status(500).json({ message: 'Failed to fetch detailed player statistics' });
    }
  });

  // Player Performance Comparison
  app.get('/api/player-statistics/compare', async (req, res) => {
    try {
      const { players } = req.query;
      const playerIds = (players as string)?.split(',').map(id => parseInt(id)) || [];
      
      const comparisons = await Promise.all(
        playerIds.map(id => storage.getDetailedPlayerStats(id))
      );
      
      res.json(comparisons.filter(Boolean));
    } catch (error) {
      console.error('Error comparing player statistics:', error);
      res.status(500).json({ message: 'Failed to compare player statistics' });
    }
  });

  // Franchise Statistics Summary
  app.get('/api/franchise-statistics/:franchiseId', async (req, res) => {
    try {
      const franchiseId = parseInt(req.params.franchiseId);
      const franchiseStats = await storage.getPlayerStatistics({
        search: '',
        franchise: franchiseId.toString(),
        role: 'all'
      });
      
      // Calculate franchise aggregates
      const franchiseSummary = {
        totalPlayers: franchiseStats.length,
        totalRuns: franchiseStats.reduce((sum, p) => sum + (p.stats?.totalRuns || 0), 0),
        totalWickets: franchiseStats.reduce((sum, p) => sum + (p.stats?.totalWickets || 0), 0),
        totalMatches: Math.max(...franchiseStats.map(p => p.stats?.totalMatches || 0)),
        averageStrikeRate: franchiseStats.length > 0 ? 
          franchiseStats.reduce((sum, p) => sum + (p.stats?.strikeRate || 0), 0) / franchiseStats.length : 0,
        averageEconomyRate: franchiseStats.length > 0 ? 
          franchiseStats.reduce((sum, p) => sum + (p.stats?.economyRate || 0), 0) / franchiseStats.length : 0,
        topPerformers: franchiseStats
          .sort((a, b) => (b.stats?.totalRuns || 0) - (a.stats?.totalRuns || 0))
          .slice(0, 5)
      };
      
      res.json({ franchiseSummary, players: franchiseStats });
    } catch (error) {
      console.error('Error fetching franchise statistics:', error);
      res.status(500).json({ message: 'Failed to fetch franchise statistics' });
    }
  });
}