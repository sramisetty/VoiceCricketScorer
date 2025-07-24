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
  app.get('/api/players/stats', async (req, res) => {
    try {
      const { search, team, role } = req.query;
      const playerStats = await storage.getPlayerStatistics({
        search: search as string,
        team: team as string,
        role: role as string
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
      res.json(detailedStats);
    } catch (error) {
      console.error('Error fetching detailed player statistics:', error);
      res.status(500).json({ message: 'Failed to fetch detailed player statistics' });
    }
  });
}