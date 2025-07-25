import { Router } from 'express';
import { authenticateToken, requireRole, AuthenticatedRequest } from './auth';
import { storage } from './storage';
import { insertPlayerSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all players in the pool (admin and global_admin only)
router.get('/players', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const players = await storage.getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get available players (for match selection) - needed for match creation
router.get('/players/available', authenticateToken, requireRole(['admin', 'global_admin', 'franchise_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const players = await storage.getAvailablePlayers();
    res.json(players);
  } catch (error) {
    console.error('Get available players error:', error);
    res.status(500).json({ error: 'Failed to fetch available players' });
  }
});

// Search players - admin and global_admin only
router.get('/players/search', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const players = await storage.searchPlayers(q);
    res.json(players);
  } catch (error) {
    console.error('Search players error:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

// Create new player - admin and global_admin only
router.post('/players', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const playerData = insertPlayerSchema.parse(req.body);
    
    const newPlayer = await storage.createPlayer({
      ...playerData,
      isActive: true,
      availability: true,
      stats: {
        totalMatches: 0,
        totalRuns: 0,
        totalWickets: 0,
        highestScore: 0,
        bestBowling: "0/0"
      }
    });

    res.status(201).json({
      message: 'Player created successfully',
      player: newPlayer
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Get single player - admin and global_admin only
router.get('/players/:id', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const player = await storage.getPlayer(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Update player - admin and global_admin only
router.patch('/players/:id', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const allowedFields = [
      'name', 'role', 'teamId', 'battingOrder', 'contactInfo', 
      'availability', 'preferredPosition', 'isActive'
    ];
    
    const updates = Object.keys(req.body)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedPlayer = await storage.updatePlayer(id, {
      ...updates,
      updatedAt: new Date()
    });

    if (!updatedPlayer) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      message: 'Player updated successfully',
      player: updatedPlayer
    });
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Check if player can be deleted - admin and global_admin only
router.get('/players/:id/can-delete', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const canDelete = await storage.canDeletePlayer(id);
    res.json({ 
      canDelete, 
      message: canDelete 
        ? 'Player can be deleted' 
        : 'Player cannot be deleted - they are part of existing matches' 
    });
  } catch (error) {
    console.error('Check delete player error:', error);
    res.status(500).json({ error: 'Failed to check if player can be deleted' });
  }
});

// Delete player (hard delete if not part of any match) - admin and global_admin only
router.delete('/players/:id', authenticateToken, requireRole(['admin', 'global_admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const success = await storage.deletePlayer(id);
    
    if (!success) {
      // Check if player can be deleted first to give specific error message
      const canDelete = await storage.canDeletePlayer(id);
      if (!canDelete) {
        return res.status(400).json({ 
          error: 'Cannot delete player - they are part of existing matches. Players can only be deleted if they have never been selected for any match.' 
        });
      }
      return res.status(404).json({ error: 'Player not found or failed to delete' });
    }

    res.json({ 
      success: true, 
      message: 'Player deleted successfully' 
    });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Get players by team
router.get('/teams/:teamId/players', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const players = await storage.getPlayersByTeam(teamId);
    res.json(players);
  } catch (error) {
    console.error('Get team players error:', error);
    res.status(500).json({ error: 'Failed to fetch team players' });
  }
});

// Update player stats (usually done automatically during matches)
router.patch('/players/:id/stats', authenticateToken, requireRole(['admin', 'global_admin', 'scorer']), async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const { stats } = req.body;
    if (!stats) {
      return res.status(400).json({ error: 'Stats object is required' });
    }

    const player = await storage.getPlayer(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const currentStats = player.stats as any || {};
    const updatedStats = { ...currentStats, ...stats };

    const updatedPlayer = await storage.updatePlayer(id, {
      stats: updatedStats,
      updatedAt: new Date()
    });

    res.json({
      message: 'Player stats updated successfully',
      player: updatedPlayer
    });
  } catch (error) {
    console.error('Update player stats error:', error);
    res.status(500).json({ error: 'Failed to update player stats' });
  }
});

export default router;