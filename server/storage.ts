import { 
  franchises, teams, players, matches, innings, balls, playerStats, users, matchPlayerSelections, userPlayerLinks, playerFranchiseLinks,
  type Franchise, type Team, type Player, type Match, type Innings, type Ball, type PlayerStats, type User, type MatchPlayerSelection, type PlayerFranchiseLink,
  type InsertFranchise, type InsertTeam, type InsertPlayer, type InsertMatch, type InsertInnings, type InsertBall, type InsertPlayerStats, type InsertUser, type InsertMatchPlayerSelection, type InsertPlayerFranchiseLink,
  type MatchWithTeams, type InningsWithStats, type LiveMatchData, type PlayerWithStats, type MatchWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, isNull, max, sum, count, sql, ilike } from "drizzle-orm";
import { cricketRules, type CricketRuleValidation } from "./cricket-rules";

export interface IStorage {
  // Franchises
  createFranchise(franchise: InsertFranchise): Promise<Franchise>;
  getFranchise(id: number): Promise<Franchise | undefined>;
  getAllFranchises(): Promise<Franchise[]>;
  updateFranchise(id: number, franchise: Partial<Franchise>): Promise<Franchise | undefined>;
  deleteFranchise(id: number): Promise<boolean>;
  getFranchiseUsers(franchiseId: number): Promise<User[]>;
  getFranchiseTeams(franchiseId: number): Promise<Team[]>;
  getFranchisePlayers(franchiseId: number): Promise<Player[]>;

  // Users (Authentication & Management)
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  linkUserToPlayer(userId: number, playerId: number | null): Promise<User | undefined>;

  // Teams
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;

  // Players (Enhanced with pool management)
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByTeam(teamId: number): Promise<Player[]>;
  getAllPlayers(): Promise<PlayerWithStats[]>;
  getAvailablePlayers(): Promise<PlayerWithStats[]>;
  updatePlayer(id: number, player: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: number): Promise<boolean>;
  canDeletePlayer(id: number): Promise<boolean>;
  searchPlayers(query: string): Promise<PlayerWithStats[]>;
  addPlayerToFranchise(playerId: number, franchiseId: number): Promise<boolean>;

  // Player-Franchise Links
  createPlayerFranchiseLink(link: InsertPlayerFranchiseLink): Promise<PlayerFranchiseLink>;
  getPlayerFranchiseLinks(playerId: number): Promise<PlayerFranchiseLink[]>;
  removePlayerFranchiseLink(playerId: number, franchiseId: number): Promise<boolean>;

  // Matches (Enhanced with user creation)
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  getMatchWithTeams(id: number): Promise<MatchWithTeams | undefined>;
  getMatchWithDetails(id: number): Promise<MatchWithDetails | undefined>;
  updateMatch(id: number, match: Partial<Match>): Promise<Match | undefined>;
  deleteMatch(id: number): Promise<boolean>;
  getAllMatches(): Promise<MatchWithTeams[]>;
  getMatchesByUser(userId: number): Promise<MatchWithTeams[]>;

  // Match Player Selection
  addPlayerToMatch(selection: InsertMatchPlayerSelection): Promise<MatchPlayerSelection>;
  removePlayerFromMatch(matchId: number, playerId: number): Promise<boolean>;
  getMatchPlayers(matchId: number): Promise<(MatchPlayerSelection & { player: Player })[]>;
  updatePlayerSelection(matchId: number, playerId: number, updates: Partial<MatchPlayerSelection>): Promise<MatchPlayerSelection | undefined>;

  // Innings
  createInnings(innings: InsertInnings): Promise<Innings>;
  getInnings(id: number): Promise<Innings | undefined>;
  getInningsByMatch(matchId: number): Promise<Innings[]>;
  getCurrentInnings(matchId: number): Promise<InningsWithStats | undefined>;
  updateInnings(id: number, innings: Partial<Innings>): Promise<Innings | undefined>;

  // Balls
  createBall(ball: InsertBall): Promise<Ball>;
  getBall(id: number): Promise<Ball | undefined>;
  getBallsByInnings(inningsId: number): Promise<Ball[]>;
  getRecentBalls(inningsId: number, count: number): Promise<(Ball & { batsman: Player; bowler: Player })[]>;
  undoLastBall(inningsId: number): Promise<boolean>;
  validateBallWithICCRules(ball: InsertBall, inningsId: number): Promise<CricketRuleValidation>;

  // Player Stats
  createPlayerStats(stats: InsertPlayerStats): Promise<PlayerStats>;
  getPlayerStats(id: number): Promise<PlayerStats | undefined>;
  getPlayerStatsByInnings(inningsId: number): Promise<(PlayerStats & { player: Player })[]>;
  updatePlayerStats(id: number, stats: Partial<PlayerStats>): Promise<PlayerStats | undefined>;
  getCurrentBatsmen(inningsId: number): Promise<(PlayerStats & { player: Player })[]>;
  getCurrentBowler(inningsId: number): Promise<(PlayerStats & { player: Player }) | undefined>;

  // Live Match Data
  getLiveMatchData(matchId: number): Promise<LiveMatchData | undefined>;

  // Cricket Logic
  updateStrikeRotation(inningsId: number, batsmanId: number, runs: number, isExtra: boolean): Promise<void>;
  
  // Match Reset
  clearMatchData(matchId: number): Promise<void>;

  // Statistics Methods
  getMatchStatistics(matchId: number | null, timeRange: string): Promise<any>;
  getArchivedMatches(filters: { search?: string; status?: string; sort?: string }): Promise<any[]>;
  exportMatchData(matchId: number): Promise<any>;
  getPlayerStatistics(filters: { search?: string; team?: string; role?: string }): Promise<any[]>;
  getDetailedPlayerStats(playerId: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private teams: Map<number, Team> = new Map();
  private players: Map<number, Player> = new Map();
  private matches: Map<number, Match> = new Map();
  private innings: Map<number, Innings> = new Map();
  private balls: Map<number, Ball> = new Map();
  private playerStats: Map<number, PlayerStats> = new Map();
  
  private currentTeamId = 1;
  private currentPlayerId = 1;
  private currentMatchId = 1;
  private currentInningsId = 1;
  private currentBallId = 1;
  private currentPlayerStatsId = 1;

  // Teams
  async createTeam(team: InsertTeam): Promise<Team> {
    const id = this.currentTeamId++;
    const newTeam: Team = { ...team, id, logo: team.logo ?? null };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }

  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  // Players
  async createPlayer(player: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const newPlayer: Player = { 
      ...player, 
      id, 
      teamId: player.teamId ?? null,
      battingOrder: player.battingOrder ?? null
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByTeam(teamId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter(p => p.teamId === teamId);
  }

  async updatePlayer(id: number, player: Partial<Player>): Promise<Player | undefined> {
    const existing = this.players.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...player };
    this.players.set(id, updated);
    return updated;
  }

  // Matches
  async createMatch(match: InsertMatch): Promise<Match> {
    const id = this.currentMatchId++;
    const newMatch: Match = { 
      ...match, 
      id,
      status: match.status ?? "setup",
      tossWinnerId: match.tossWinnerId ?? null,
      tossDecision: match.tossDecision ?? null,
      currentInnings: match.currentInnings ?? 1,
      venue: match.venue ?? null,
      createdAt: new Date()
    };
    this.matches.set(id, newMatch);
    return newMatch;
  }

  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getMatchWithTeams(id: number): Promise<MatchWithTeams | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;

    const team1 = this.teams.get(match.team1Id);
    const team2 = this.teams.get(match.team2Id);
    if (!team1 || !team2) return undefined;

    const tossWinner = match.tossWinnerId ? this.teams.get(match.tossWinnerId) : undefined;

    return {
      ...match,
      team1,
      team2,
      tossWinner
    };
  }

  async updateMatch(id: number, match: Partial<Match>): Promise<Match | undefined> {
    const existing = this.matches.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...match };
    this.matches.set(id, updated);
    return updated;
  }

  async clearMatchData(matchId: number): Promise<void> {
    // Find all innings for this match
    const matchInnings = Array.from(this.innings.values()).filter(i => i.matchId === matchId);
    
    // Delete all balls for these innings
    const inningsIds = matchInnings.map(i => i.id);
    const ballsToDelete = Array.from(this.balls.keys()).filter(ballId => {
      const ball = this.balls.get(ballId);
      return ball && inningsIds.includes(ball.inningsId);
    });
    ballsToDelete.forEach(ballId => this.balls.delete(ballId));
    
    // Delete all player stats for these innings
    const statsToDelete = Array.from(this.playerStats.keys()).filter(statsId => {
      const stats = this.playerStats.get(statsId);
      return stats && inningsIds.includes(stats.inningsId);
    });
    statsToDelete.forEach(statsId => this.playerStats.delete(statsId));
    
    // Delete all innings for this match
    const inningsToDelete = Array.from(this.innings.keys()).filter(inningsId => {
      const innings = this.innings.get(inningsId);
      return innings && innings.matchId === matchId;
    });
    inningsToDelete.forEach(inningsId => this.innings.delete(inningsId));
  }

  async getAllMatches(): Promise<MatchWithTeams[]> {
    const matches = Array.from(this.matches.values());
    const result: MatchWithTeams[] = [];
    
    for (const match of matches) {
      const withTeams = await this.getMatchWithTeams(match.id);
      if (withTeams) result.push(withTeams);
    }
    
    return result;
  }

  // Innings
  async createInnings(innings: InsertInnings): Promise<Innings> {
    const id = this.currentInningsId++;
    const newInnings: Innings = { 
      ...innings, 
      id,
      totalRuns: innings.totalRuns ?? 0,
      totalWickets: innings.totalWickets ?? 0,
      totalOvers: innings.totalOvers ?? 0,
      totalBalls: innings.totalBalls ?? 0,
      extras: innings.extras ?? { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
      isCompleted: innings.isCompleted ?? false,
      currentBowlerId: innings.currentBowlerId ?? null
    };
    this.innings.set(id, newInnings);
    return newInnings;
  }

  async getInnings(id: number): Promise<Innings | undefined> {
    return this.innings.get(id);
  }

  async getInningsByMatch(matchId: number): Promise<Innings[]> {
    return Array.from(this.innings.values()).filter(i => i.matchId === matchId);
  }

  async getCurrentInnings(matchId: number): Promise<InningsWithStats | undefined> {
    const match = this.matches.get(matchId);
    if (!match) return undefined;

    const matchInnings = Array.from(this.innings.values())
      .filter(i => i.matchId === matchId)
      .sort((a, b) => a.inningsNumber - b.inningsNumber);

    const currentInnings = matchInnings[(match.currentInnings ?? 1) - 1];
    if (!currentInnings) return undefined;

    const battingTeam = this.teams.get(currentInnings.battingTeamId);
    const bowlingTeam = this.teams.get(currentInnings.bowlingTeamId);
    if (!battingTeam || !bowlingTeam) return undefined;

    const inningsBalls = Array.from(this.balls.values())
      .filter(b => b.inningsId === currentInnings.id)
      .sort((a, b) => a.overNumber - b.overNumber || a.ballNumber - b.ballNumber);

    const inningsStats = await this.getPlayerStatsByInnings(currentInnings.id);

    return {
      ...currentInnings,
      battingTeam,
      bowlingTeam,
      balls: inningsBalls,
      playerStats: inningsStats
    };
  }

  async updateInnings(id: number, innings: Partial<Innings>): Promise<Innings | undefined> {
    const existing = this.innings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...innings };
    this.innings.set(id, updated);
    return updated;
  }

  // Balls
  async createBall(ball: InsertBall): Promise<Ball> {
    const id = this.currentBallId++;
    const newBall: Ball = { 
      ...ball, 
      id,
      runs: ball.runs ?? 0,
      isWicket: ball.isWicket ?? false,
      wicketType: ball.wicketType ?? null,
      fielderId: ball.fielderId ?? null,
      extraType: ball.extraType ?? null,
      extraRuns: ball.extraRuns ?? 0,
      commentary: ball.commentary ?? null,
      createdAt: new Date()
    };
    this.balls.set(id, newBall);
    return newBall;
  }

  async getBall(id: number): Promise<Ball | undefined> {
    return this.balls.get(id);
  }

  async getBallsByInnings(inningsId: number): Promise<Ball[]> {
    return Array.from(this.balls.values())
      .filter(b => b.inningsId === inningsId)
      .sort((a, b) => a.overNumber - b.overNumber || a.ballNumber - b.ballNumber);
  }

  async getRecentBalls(inningsId: number, count: number): Promise<(Ball & { batsman: Player; bowler: Player })[]> {
    const inningsBalls = Array.from(this.balls.values())
      .filter(b => b.inningsId === inningsId)
      .sort((a, b) => b.overNumber - a.overNumber || b.ballNumber - a.ballNumber)
      .slice(0, count);

    const result: (Ball & { batsman: Player; bowler: Player })[] = [];
    
    for (const ball of inningsBalls) {
      const batsman = this.players.get(ball.batsmanId);
      const bowler = this.players.get(ball.bowlerId);
      if (batsman && bowler) {
        result.push({ ...ball, batsman, bowler });
      }
    }
    
    return result;
  }

  async undoLastBall(inningsId: number): Promise<boolean> {
    const inningsBalls = Array.from(this.balls.values())
      .filter(b => b.inningsId === inningsId)
      .sort((a, b) => b.overNumber - a.overNumber || b.ballNumber - a.ballNumber);

    if (inningsBalls.length === 0) return false;

    const lastBall = inningsBalls[0];
    this.balls.delete(lastBall.id);
    return true;
  }

  // Player Stats
  async createPlayerStats(stats: InsertPlayerStats): Promise<PlayerStats> {
    const id = this.currentPlayerStatsId++;
    const newStats: PlayerStats = { 
      ...stats, 
      id,
      runs: stats.runs ?? 0,
      ballsFaced: stats.ballsFaced ?? 0,
      fours: stats.fours ?? 0,
      sixes: stats.sixes ?? 0,
      isOut: stats.isOut ?? false,
      isOnStrike: stats.isOnStrike ?? false,
      oversBowled: stats.oversBowled ?? 0,
      ballsBowled: stats.ballsBowled ?? 0,
      runsConceded: stats.runsConceded ?? 0,
      wicketsTaken: stats.wicketsTaken ?? 0
    };
    this.playerStats.set(id, newStats);
    return newStats;
  }

  async getPlayerStats(id: number): Promise<PlayerStats | undefined> {
    return this.playerStats.get(id);
  }

  async getPlayerStatsByInnings(inningsId: number): Promise<(PlayerStats & { player: Player })[]> {
    const inningsStats = Array.from(this.playerStats.values())
      .filter(s => s.inningsId === inningsId);

    const result: (PlayerStats & { player: Player })[] = [];
    
    for (const stats of inningsStats) {
      const player = this.players.get(stats.playerId);
      if (player) {
        result.push({ ...stats, player });
      }
    }
    
    return result;
  }

  async updatePlayerStats(id: number, stats: Partial<PlayerStats>): Promise<PlayerStats | undefined> {
    const existing = this.playerStats.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...stats };
    this.playerStats.set(id, updated);
    return updated;
  }

  async getCurrentBatsmen(inningsId: number): Promise<(PlayerStats & { player: Player })[]> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    return inningsStats.filter(s => !s.isOut).slice(-2); // Last 2 not out batsmen
  }

  async getCurrentBowler(inningsId: number): Promise<(PlayerStats & { player: Player }) | undefined> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    return inningsStats.find(s => (s.ballsBowled ?? 0) > 0 && (s.ballsBowled ?? 0) % 6 !== 0); // Current bowler
  }

  // Live Match Data
  async getLiveMatchData(matchId: number): Promise<LiveMatchData | undefined> {
    const matchWithTeams = await this.getMatchWithTeams(matchId);
    if (!matchWithTeams) return undefined;

    const currentInnings = await this.getCurrentInnings(matchId);
    if (!currentInnings) return undefined;

    const recentBalls = await this.getRecentBalls(currentInnings.id, 10);
    const currentBatsmen = await this.getCurrentBatsmen(currentInnings.id);
    const currentBowler = await this.getCurrentBowler(currentInnings.id);

    return {
      match: matchWithTeams,
      currentInnings,
      recentBalls,
      currentBatsmen,
      currentBowler: currentBowler!
    };
  }

  // Cricket Logic - Strike Rotation
  async updateStrikeRotation(inningsId: number, batsmanId: number, runs: number, isExtra: boolean): Promise<void> {
    // Cricket rule: On odd runs (1, 3, 5), batsmen cross over
    // On even runs (0, 2, 4, 6), batsmen stay in same positions
    // On extras (wide, no-ball), no strike rotation unless runs are taken
    
    if (isExtra && runs === 0) {
      // No strike rotation on extras with no runs
      return;
    }
    
    const shouldRotateStrike = runs % 2 === 1; // Odd runs = strike rotation
    
    if (shouldRotateStrike) {
      // Get current batsmen
      const currentBatsmen = await this.getCurrentBatsmen(inningsId);
      
      if (currentBatsmen.length >= 2) {
        // Find the non-striker (the batsman who didn't face this ball)
        const nonStriker = currentBatsmen.find(b => b.playerId !== batsmanId);
        
        if (nonStriker) {
          // Set the non-striker as the new striker by updating their position
          // This is a simplified implementation - in a full system, we'd track isOnStrike field
          console.log(`Strike rotation: ${nonStriker.player.name} is now on strike`);
        }
      }
    }
  }

  // Match Reset
  async resetMatchData(matchId: number): Promise<void> {
    // This would be implemented for in-memory storage
    // For now, we'll use the database version
  }
}

export class DatabaseStorage implements IStorage {
  // Franchises
  async createFranchise(franchise: InsertFranchise): Promise<Franchise> {
    const [newFranchise] = await db.insert(franchises).values(franchise).returning();
    return newFranchise;
  }

  async getFranchise(id: number): Promise<Franchise | undefined> {
    const [franchise] = await db.select().from(franchises).where(eq(franchises.id, id));
    return franchise;
  }

  async getAllFranchises(): Promise<Franchise[]> {
    return await db.select().from(franchises).where(eq(franchises.isActive, true));
  }

  async updateFranchise(id: number, franchise: Partial<Franchise>): Promise<Franchise | undefined> {
    const [updated] = await db.update(franchises)
      .set({ ...franchise, updatedAt: new Date() })
      .where(eq(franchises.id, id))
      .returning();
    return updated;
  }

  async deleteFranchise(id: number): Promise<boolean> {
    try {
      const [updated] = await db.update(franchises)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(franchises.id, id))
        .returning();
      return !!updated;
    } catch (error) {
      console.error('Error deleting franchise:', error);
      return false;
    }
  }

  async getFranchiseUsers(franchiseId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.franchiseId, franchiseId));
  }

  async getFranchiseTeams(franchiseId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.franchiseId, franchiseId));
  }

  async getFranchisePlayers(franchiseId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.franchiseId, franchiseId));
  }

  // Users (Authentication)
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // First remove any user-player links
      await db.delete(userPlayerLinks).where(eq(userPlayerLinks.userId, id));
      
      // Then delete the user
      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async linkUserToPlayer(userId: number, playerId: number | null): Promise<User | undefined> {
    try {
      // Remove existing links for this user
      await db.delete(userPlayerLinks).where(eq(userPlayerLinks.userId, userId));
      
      // Create new link if playerId is provided
      if (playerId) {
        await db.insert(userPlayerLinks).values({
          userId,
          playerId
        });
      }
      
      // Return updated user
      return this.getUser(userId);
    } catch (error) {
      console.error("Error linking user to player:", error);
      return undefined;
    }
  }

  // Teams
  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  // Players
  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async getPlayersByTeam(teamId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.teamId, teamId));
  }

  async updatePlayer(id: number, player: Partial<Player>): Promise<Player | undefined> {
    const [updatedPlayer] = await db.update(players).set(player).where(eq(players.id, id)).returning();
    return updatedPlayer;
  }

  async getAllPlayers(): Promise<PlayerWithStats[]> {
    const allPlayers = await db.select().from(players).where(eq(players.isActive, true));
    const result: PlayerWithStats[] = [];
    
    for (const player of allPlayers) {
      const stats = player.stats as any || {};
      result.push({
        ...player,
        totalMatches: stats.totalMatches || 0,
        totalRuns: stats.totalRuns || 0,
        totalWickets: stats.totalWickets || 0,
        averageRuns: stats.totalMatches > 0 ? stats.totalRuns / stats.totalMatches : 0,
        strikeRate: 0, // TODO: Calculate from actual match data
        economyRate: 0, // TODO: Calculate from actual match data
      });
    }
    
    return result;
  }

  async getAvailablePlayers(): Promise<PlayerWithStats[]> {
    const availablePlayers = await db.select().from(players)
      .where(and(eq(players.isActive, true), eq(players.availability, true)));
    
    const result: PlayerWithStats[] = [];
    
    for (const player of availablePlayers) {
      const stats = player.stats as any || {};
      result.push({
        ...player,
        totalMatches: stats.totalMatches || 0,
        totalRuns: stats.totalRuns || 0,
        totalWickets: stats.totalWickets || 0,
        averageRuns: stats.totalMatches > 0 ? stats.totalRuns / stats.totalMatches : 0,
        strikeRate: 0,
        economyRate: 0,
      });
    }
    
    return result;
  }

  async canDeletePlayer(id: number): Promise<boolean> {
    // Check if player is part of any match (including completed matches)
    const matchSelections = await db.select().from(matchPlayerSelections)
      .where(eq(matchPlayerSelections.playerId, id));
    
    // If player has been selected for any match, they cannot be deleted
    return matchSelections.length === 0;
  }

  async deletePlayer(id: number): Promise<boolean> {
    try {
      // Check if player exists first
      const [existingPlayer] = await db.select().from(players).where(eq(players.id, id));
      if (!existingPlayer) {
        return false;
      }

      // Check if player can be deleted (not part of any match)
      const canDelete = await this.canDeletePlayer(id);
      if (!canDelete) {
        return false;
      }

      // Delete player stats first (to avoid foreign key constraint violation)
      try {
        await db.delete(playerStats).where(eq(playerStats.playerId, id));
      } catch (statsError: any) {
        // Ignore if playerStats table doesn't exist or no stats to delete
        console.log('Player stats deletion failed or no stats to delete:', statsError?.message);
      }

      // Try to delete user-player links if they exist (optional, table might not exist yet)
      try {
        await db.delete(userPlayerLinks).where(eq(userPlayerLinks.playerId, id));
      } catch (linkError) {
        // Ignore if userPlayerLinks table doesn't exist yet
        console.log('User-player links table not found, skipping link deletion');
      }

      // Hard delete the player since they're not part of any match
      const [deletedPlayer] = await db.delete(players).where(eq(players.id, id)).returning();
      
      return !!deletedPlayer;
    } catch (error) {
      console.error('Error deleting player:', error);
      return { success: false, error: `Database error: ${error.message}` };
    }
  }

  async searchPlayers(query: string): Promise<PlayerWithStats[]> {
    // Search players by name using ILIKE for PostgreSQL case-insensitive search
    const searchResults = await db.select()
      .from(players)
      .where(
        and(
          eq(players.isActive, true),
          ilike(players.name, `%${query}%`)
        )
      );
    
    const result: PlayerWithStats[] = [];
    
    for (const player of searchResults) {
      const stats = player.stats as any || {};
      result.push({
        ...player,
        totalMatches: stats.totalMatches || 0,
        totalRuns: stats.totalRuns || 0,
        totalWickets: stats.totalWickets || 0,
        averageRuns: stats.totalMatches > 0 ? stats.totalRuns / stats.totalMatches : 0,
        strikeRate: 0,
        economyRate: 0,
      });
    }
    
    return result;
  }

  async addPlayerToFranchise(playerId: number, franchiseId: number): Promise<boolean> {
    try {
      // Check if player exists
      const player = await this.getPlayer(playerId);
      if (!player) {
        return false;
      }

      // Check if franchise exists
      const franchise = await this.getFranchise(franchiseId);
      if (!franchise) {
        return false;
      }

      // Update player's franchise ID
      await db.update(players)
        .set({ franchiseId: franchiseId })
        .where(eq(players.id, playerId));

      return true;
    } catch (error) {
      console.error("Error adding player to franchise:", error);
      return false;
    }
  }

  // Matches
  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }

  async getMatchWithTeams(id: number): Promise<MatchWithTeams | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return undefined;

    const [team1] = await db.select().from(teams).where(eq(teams.id, match.team1Id));
    const [team2] = await db.select().from(teams).where(eq(teams.id, match.team2Id));

    if (!team1 || !team2) return undefined;

    return { ...match, team1, team2 };
  }

  async updateMatch(id: number, match: Partial<Match>): Promise<Match | undefined> {
    const [updatedMatch] = await db.update(matches).set(match).where(eq(matches.id, id)).returning();
    return updatedMatch;
  }

  async deleteMatch(id: number): Promise<boolean> {
    try {
      // Delete all related data in the correct order to avoid foreign key constraints
      
      // 1. Get all innings for this match
      const matchInnings = await db.select().from(innings).where(eq(innings.matchId, id));
      
      // 2. Delete balls for each innings
      for (const inning of matchInnings) {
        await db.delete(balls).where(eq(balls.inningsId, inning.id));
      }
      
      // 3. Delete player stats for each innings
      for (const inning of matchInnings) {
        await db.delete(playerStats).where(eq(playerStats.inningsId, inning.id));
      }
      
      // 4. Delete match player selections
      await db.delete(matchPlayerSelections).where(eq(matchPlayerSelections.matchId, id));
      
      // 5. Delete innings
      await db.delete(innings).where(eq(innings.matchId, id));
      
      // 6. Finally delete the match
      const [deletedMatch] = await db.delete(matches).where(eq(matches.id, id)).returning();
      
      return !!deletedMatch;
    } catch (error) {
      console.error('Error deleting match:', error);
      return false;
    }
  }

  async getAllMatches(): Promise<MatchWithTeams[]> {
    const allMatches = await db.select().from(matches);
    const result: MatchWithTeams[] = [];
    
    for (const match of allMatches) {
      const [team1] = await db.select().from(teams).where(eq(teams.id, match.team1Id));
      const [team2] = await db.select().from(teams).where(eq(teams.id, match.team2Id));
      const [createdByUser] = await db.select().from(users).where(eq(users.id, match.createdBy));
      
      if (team1 && team2 && createdByUser) {
        result.push({ ...match, team1, team2, createdByUser });
      }
    }
    
    return result;
  }

  async getMatchesByUser(userId: number): Promise<MatchWithTeams[]> {
    const userMatches = await db.select().from(matches).where(eq(matches.createdBy, userId));
    const result: MatchWithTeams[] = [];
    
    for (const match of userMatches) {
      const [team1] = await db.select().from(teams).where(eq(teams.id, match.team1Id));
      const [team2] = await db.select().from(teams).where(eq(teams.id, match.team2Id));
      const [createdByUser] = await db.select().from(users).where(eq(users.id, match.createdBy));
      
      if (team1 && team2 && createdByUser) {
        result.push({ ...match, team1, team2, createdByUser });
      }
    }
    
    return result;
  }

  async getMatchWithDetails(id: number): Promise<MatchWithDetails | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return undefined;

    const [team1Data] = await db.select().from(teams).where(eq(teams.id, match.team1Id));
    const [team2Data] = await db.select().from(teams).where(eq(teams.id, match.team2Id));
    const [createdByUser] = await db.select().from(users).where(eq(users.id, match.createdBy));
    
    if (!team1Data || !team2Data || !createdByUser) return undefined;

    const team1Players = await db.select().from(players).where(eq(players.teamId, match.team1Id));
    const team2Players = await db.select().from(players).where(eq(players.teamId, match.team2Id));
    
    const selectedPlayers = await this.getMatchPlayers(id);

    return {
      ...match,
      team1: { ...team1Data, players: team1Players },
      team2: { ...team2Data, players: team2Players },
      createdByUser,
      selectedPlayers
    };
  }

  // Match Player Selection
  async addPlayerToMatch(selection: InsertMatchPlayerSelection): Promise<MatchPlayerSelection> {
    const [newSelection] = await db.insert(matchPlayerSelections).values(selection).returning();
    return newSelection;
  }

  async removePlayerFromMatch(matchId: number, playerId: number): Promise<boolean> {
    const deleted = await db.delete(matchPlayerSelections)
      .where(and(
        eq(matchPlayerSelections.matchId, matchId),
        eq(matchPlayerSelections.playerId, playerId)
      ));
    return true;
  }

  async getMatchPlayers(matchId: number): Promise<(MatchPlayerSelection & { player: Player })[]> {
    const selections = await db.select().from(matchPlayerSelections)
      .where(eq(matchPlayerSelections.matchId, matchId));
    
    const result: (MatchPlayerSelection & { player: Player })[] = [];
    
    for (const selection of selections) {
      const [player] = await db.select().from(players).where(eq(players.id, selection.playerId));
      if (player) {
        result.push({ ...selection, player });
      }
    }
    
    return result;
  }

  async updatePlayerSelection(matchId: number, playerId: number, updates: Partial<MatchPlayerSelection>): Promise<MatchPlayerSelection | undefined> {
    const [updatedSelection] = await db.update(matchPlayerSelections)
      .set(updates)
      .where(and(
        eq(matchPlayerSelections.matchId, matchId),
        eq(matchPlayerSelections.playerId, playerId)
      ))
      .returning();
    return updatedSelection;
  }

  // Innings
  async createInnings(inning: InsertInnings): Promise<Innings> {
    const [newInnings] = await db.insert(innings).values(inning).returning();
    return newInnings;
  }

  async getInnings(id: number): Promise<Innings | undefined> {
    const [inning] = await db.select().from(innings).where(eq(innings.id, id));
    return inning;
  }

  async getInningsByMatch(matchId: number): Promise<Innings[]> {
    return await db.select().from(innings).where(eq(innings.matchId, matchId));
  }

  async getCurrentInnings(matchId: number): Promise<InningsWithStats | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return undefined;

    const matchInnings = await db.select().from(innings)
      .where(eq(innings.matchId, matchId))
      .orderBy(innings.inningsNumber);

    const currentInnings = matchInnings[(match.currentInnings ?? 1) - 1];
    if (!currentInnings) return undefined;

    const [battingTeam] = await db.select().from(teams).where(eq(teams.id, currentInnings.battingTeamId));
    const [bowlingTeam] = await db.select().from(teams).where(eq(teams.id, currentInnings.bowlingTeamId));
    
    if (!battingTeam || !bowlingTeam) return undefined;

    const inningsBalls = await db.select().from(balls)
      .where(eq(balls.inningsId, currentInnings.id))
      .orderBy(balls.overNumber, balls.ballNumber);

    const inningsStats = await this.getPlayerStatsByInnings(currentInnings.id);

    return {
      ...currentInnings,
      battingTeam,
      bowlingTeam,
      balls: inningsBalls,
      playerStats: inningsStats
    };
  }

  async updateInnings(id: number, inning: Partial<Innings>): Promise<Innings | undefined> {
    const [updatedInnings] = await db.update(innings).set(inning).where(eq(innings.id, id)).returning();
    return updatedInnings;
  }

  // Balls
  async createBall(ball: InsertBall): Promise<Ball> {
    // Apply comprehensive ICC cricket rules validation
    const validation = await this.validateBallWithICCRules(ball, ball.inningsId);
    
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || "ICC Cricket Rule Violation");
    }

    // Use adjusted ball data if rules engine modified it
    const finalBall = validation.adjustedBall ? { ...ball, ...validation.adjustedBall } : ball;
    
    const [newBall] = await db.insert(balls).values({
      ...finalBall,
      createdAt: new Date()
    }).returning();

    // ICC Rule: Check if over is completed and apply end-of-over strike rotation
    await this.checkAndHandleOverCompletion(finalBall.inningsId, finalBall.overNumber);
    
    return newBall;
  }

  async validateBallWithICCRules(ball: InsertBall, inningsId: number): Promise<CricketRuleValidation> {
    try {
      // Get current innings and existing balls for context
      const [currentInnings] = await db.select().from(innings).where(eq(innings.id, inningsId));
      if (!currentInnings) {
        return { isValid: false, errorMessage: "Innings not found" };
      }

      // Get existing balls in this over
      const overBalls = await db.select().from(balls)
        .where(eq(balls.inningsId, inningsId))
        .where(eq(balls.overNumber, ball.overNumber));

      // ICC Rule 17.6: Bowler consecutive overs validation
      if (ball.overNumber > 1) {
        const [previousOverLastBall] = await db.select().from(balls)
          .where(eq(balls.inningsId, inningsId))
          .where(eq(balls.overNumber, ball.overNumber - 1))
          .orderBy(desc(balls.ballNumber))
          .limit(1);

        const consecutiveValidation = cricketRules.validateBowlerConsecutiveOvers(
          previousOverLastBall?.bowlerId || null, 
          ball.bowlerId
        );
        if (!consecutiveValidation.isValid) return consecutiveValidation;
      }

      // ICC Rule 17: Over validation (6 balls max)
      const overValidation = cricketRules.validateOver(overBalls, ball);
      if (!overValidation.isValid) return overValidation;

      // ICC Rule 18: Scoring runs validation
      const scoringValidation = cricketRules.validateScoringRuns(ball);
      if (!scoringValidation.isValid) return scoringValidation;

      // ICC Rule 21: No ball validation
      const noBallValidation = cricketRules.validateNoBall(ball);
      if (!noBallValidation.isValid) return noBallValidation;

      // ICC Rule 22: Wide ball validation  
      const wideBallValidation = cricketRules.validateWideBall(ball);
      if (!wideBallValidation.isValid) return wideBallValidation;

      // ICC Rule 18.4/18.5: Short runs validation
      const shortRunValidation = cricketRules.validateShortRuns(ball);
      if (!shortRunValidation.isValid) return shortRunValidation;

      // ICC Rule 20: Dead ball validation
      const deadBallValidation = cricketRules.validateDeadBall(ball);
      if (!deadBallValidation.isValid) return deadBallValidation;

      // ICC Rule 23: Bye and leg-bye validation
      const byeValidation = cricketRules.validateByeAndLegBye(ball);
      if (!byeValidation.isValid) return byeValidation;

      // ICC Rule: Maximum 10 wickets validation
      if (ball.isWicket) {
        const wicketValidation = cricketRules.validateWicketLimit(currentInnings.totalWickets || 0);
        if (!wicketValidation.isValid) return wicketValidation;

        // Validate dismissal type
        if (ball.wicketType) {
          const dismissalValidation = cricketRules.validateDismissalType(ball.wicketType);
          if (!dismissalValidation.isValid) return dismissalValidation;
        }
      }

      // Combine adjustments from all validations
      let adjustedBall = { ...ball };
      
      // Apply no ball adjustments
      if (noBallValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...noBallValidation.adjustedBall };
      }
      
      // Apply wide ball adjustments
      if (wideBallValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...wideBallValidation.adjustedBall };
      }
      
      // Apply short run adjustments
      if (shortRunValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...shortRunValidation.adjustedBall };
      }
      
      // Apply dead ball adjustments
      if (deadBallValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...deadBallValidation.adjustedBall };
      }
      
      // Apply bye/leg-bye adjustments
      if (byeValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...byeValidation.adjustedBall };
      }

      // Apply over adjustments (ball number corrections for extras)
      if (overValidation.adjustedBall) {
        adjustedBall = { ...adjustedBall, ...overValidation.adjustedBall };
      }

      // Calculate total penalty runs
      const totalPenaltyRuns = cricketRules.calculatePenaltyRuns(adjustedBall);
      if (totalPenaltyRuns > 0) {
        adjustedBall.penaltyRuns = totalPenaltyRuns;
      }

      return {
        isValid: true,
        adjustedBall: adjustedBall !== ball ? adjustedBall : undefined
      };

    } catch (error) {
      return {
        isValid: false,
        errorMessage: `ICC Rules validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * ICC Rule: Check over completion and handle end-of-over procedures
   */
  async checkAndHandleOverCompletion(inningsId: number, overNumber: number): Promise<void> {
    // Get all balls in this over
    const overBalls = await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .where(eq(balls.overNumber, overNumber));

    // Count valid balls (exclude wides and no-balls)
    const validBalls = overBalls.filter(b => 
      !b.extraType || !['wide', 'noball'].includes(b.extraType)
    );

    // ICC Rule 17.1: Over is complete after 6 valid balls
    if (validBalls.length === 6) {
      console.log(`Over ${overNumber} completed with 6 valid balls`);
      
      // Check for maiden over
      await this.checkMaidenOver(inningsId, overNumber);
      
      // Apply end-of-over strike rotation
      await this.applyEndOfOverStrikeRotation(inningsId);
    }
  }

  /**
   * ICC Rule: Check if over is a maiden over
   */
  async checkMaidenOver(inningsId: number, overNumber: number): Promise<void> {
    const overBalls = await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .where(eq(balls.overNumber, overNumber));

    // Count total runs scored in the over (excluding penalty runs)
    const totalRuns = overBalls.reduce((sum, ball) => sum + (ball.runs || 0), 0);
    
    if (totalRuns === 0 && overBalls.length > 0) {
      // This is a maiden over
      const bowlerId = overBalls[0].bowlerId;
      const bowlerStats = await this.getPlayerStatsByInnings(inningsId);
      const bowlerStat = bowlerStats.find(s => s.playerId === bowlerId);
      
      if (bowlerStat) {
        await this.updatePlayerStats(bowlerStat.id, {
          maidenOvers: (bowlerStat.maidenOvers || 0) + 1
        });
        console.log(`Maiden over! Bowler ${bowlerStat.player.name} bowled a maiden over ${overNumber}`);
      }
    }
  }

  /**
   * ICC Rule: Automatic strike rotation at end of over
   */
  async applyEndOfOverStrikeRotation(inningsId: number): Promise<void> {
    const currentBatsmen = await this.getCurrentBatsmen(inningsId);
    
    if (currentBatsmen.length >= 2) {
      const striker = currentBatsmen.find(b => b.isOnStrike);
      const nonStriker = currentBatsmen.find(b => !b.isOnStrike);
      
      if (striker && nonStriker) {
        // ICC Rule: Non-striker becomes striker for next over
        await this.updatePlayerStats(striker.id, { isOnStrike: false });
        await this.updatePlayerStats(nonStriker.id, { isOnStrike: true });
        
        console.log(`End of over: ${nonStriker.player.name} is now on strike for next over`);
      }
    }
  }

  async getBall(id: number): Promise<Ball | undefined> {
    const [ball] = await db.select().from(balls).where(eq(balls.id, id));
    return ball;
  }

  async getBallsByInnings(inningsId: number): Promise<Ball[]> {
    return await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .orderBy(balls.overNumber, balls.ballNumber);
  }

  async getRecentBalls(inningsId: number, count: number): Promise<(Ball & { batsman: Player; bowler: Player })[]> {
    const recentBalls = await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .orderBy(desc(balls.overNumber), desc(balls.ballNumber))
      .limit(count);

    const result: (Ball & { batsman: Player; bowler: Player })[] = [];
    
    for (const ball of recentBalls) {
      const [batsman] = await db.select().from(players).where(eq(players.id, ball.batsmanId));
      const [bowler] = await db.select().from(players).where(eq(players.id, ball.bowlerId));
      
      if (batsman && bowler) {
        result.push({ ...ball, batsman, bowler });
      }
    }

    return result;
  }

  async undoLastBall(inningsId: number): Promise<boolean> {
    const [lastBall] = await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .orderBy(desc(balls.overNumber), desc(balls.ballNumber))
      .limit(1);

    if (!lastBall) return false;

    // Check if this is the first ball of an over (ball number 1) or last ball of an over (ball number 6)
    const isFirstBallOfOver = lastBall.ballNumber === 1;
    const isLastBallOfOver = lastBall.ballNumber === 6;
    let previousBowlerId: number | null = null;

    // If undoing the first ball of an over, we need to find the previous bowler
    if (isFirstBallOfOver && lastBall.overNumber > 1) {
      // Get the last ball of the previous over (over - 1, ball 6)
      const [previousOverLastBall] = await db.select().from(balls)
        .where(eq(balls.inningsId, inningsId))
        .where(eq(balls.overNumber, lastBall.overNumber - 1))
        .orderBy(desc(balls.ballNumber))
        .limit(1);
      
      if (previousOverLastBall) {
        previousBowlerId = previousOverLastBall.bowlerId;
      }
    }
    
    // If undoing the last ball of an over, we need to keep the current bowler as this bowler
    // (since they bowled this entire over)
    if (isLastBallOfOver) {
      // The current bowler should remain the same (the one who bowled this ball)
      // Don't change currentBowlerId in this case
      previousBowlerId = lastBall.bowlerId;
    }

    // Get the player stats for batsman and bowler to reverse their statistics
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    const batsmanStats = inningsStats.find(s => s.playerId === lastBall.batsmanId);
    const bowlerStats = inningsStats.find(s => s.playerId === lastBall.bowlerId);

    // Reverse batsman statistics
    if (batsmanStats) {
      const newRuns = Math.max(0, (batsmanStats.runs ?? 0) - (lastBall.runs ?? 0));
      const newBallsFaced = Math.max(0, (batsmanStats.ballsFaced ?? 0) - (lastBall.extraType ? 0 : 1));
      const newFours = lastBall.runs === 4 ? Math.max(0, (batsmanStats.fours ?? 0) - 1) : batsmanStats.fours;
      const newSixes = lastBall.runs === 6 ? Math.max(0, (batsmanStats.sixes ?? 0) - 1) : batsmanStats.sixes;
      
      await this.updatePlayerStats(batsmanStats.id, {
        runs: newRuns,
        ballsFaced: newBallsFaced,
        fours: newFours,
        sixes: newSixes,
        isOut: lastBall.isWicket ? false : batsmanStats.isOut // Reverse wicket if it was a wicket
      });
    }

    // Reverse bowler statistics
    if (bowlerStats) {
      const totalRunsToDeduct = (lastBall.runs ?? 0) + (lastBall.extraRuns ?? 0);
      const newBallsBowled = Math.max(0, (bowlerStats.ballsBowled ?? 0) - (lastBall.extraType ? 0 : 1));
      const newRunsConceded = Math.max(0, (bowlerStats.runsConceded ?? 0) - totalRunsToDeduct);
      const newWickets = lastBall.isWicket ? Math.max(0, (bowlerStats.wicketsTaken ?? 0) - 1) : bowlerStats.wicketsTaken;
      const newOversBowled = Math.floor(newBallsBowled / 6);
      
      await this.updatePlayerStats(bowlerStats.id, {
        ballsBowled: newBallsBowled,
        runsConceded: newRunsConceded,
        wicketsTaken: newWickets,
        oversBowled: newOversBowled
      });
    }

    // Update innings totals
    const [currentInnings] = await db.select().from(innings).where(eq(innings.id, inningsId));
    if (currentInnings) {
      const totalRunsToDeduct = (lastBall.runs ?? 0) + (lastBall.extraRuns ?? 0);
      const newTotalRuns = Math.max(0, (currentInnings.totalRuns ?? 0) - totalRunsToDeduct);
      const newTotalBalls = Math.max(0, (currentInnings.totalBalls ?? 0) - (lastBall.extraType ? 0 : 1));
      const newTotalWickets = lastBall.isWicket ? Math.max(0, (currentInnings.totalWickets ?? 0) - 1) : (currentInnings.totalWickets ?? 0);
      const newTotalOvers = Math.floor(newTotalBalls / 6);
      
      await db.update(innings).set({
        totalRuns: newTotalRuns,
        totalBalls: newTotalBalls,
        totalWickets: newTotalWickets,
        totalOvers: newTotalOvers
      }).where(eq(innings.id, inningsId));
    }

    // Handle bowler change reversal
    if ((isFirstBallOfOver || isLastBallOfOver) && previousBowlerId !== null) {
      // Revert the current bowler to the appropriate bowler
      await db.update(innings).set({
        currentBowlerId: previousBowlerId
      }).where(eq(innings.id, inningsId));
      
      if (isFirstBallOfOver) {
        console.log(`Undo: Reverted current bowler back to previous bowler (ID: ${previousBowlerId})`);
      } else if (isLastBallOfOver) {
        console.log(`Undo: Set current bowler to the bowler who bowled this over (ID: ${previousBowlerId})`);
      }
    }

    // Handle strike rotation reversal
    if (lastBall.runs && lastBall.runs % 2 === 1 && !lastBall.extraType) {
      // If the last ball had odd runs, reverse the strike rotation
      await this.reverseStrikeRotation(inningsId);
    }

    // Handle end-of-over strike rotation reversal
    if (lastBall.ballNumber === 6 && !lastBall.extraType) {
      // If undoing the last ball of an over, reverse the automatic strike rotation that happens at over end
      await this.reverseStrikeRotation(inningsId);
    }

    // Finally, delete the ball record
    await db.delete(balls).where(eq(balls.id, lastBall.id));
    
    console.log(`Undo: Reversed ball ${lastBall.overNumber}.${lastBall.ballNumber} - ${lastBall.runs} runs, ${lastBall.extraRuns} extras`);
    return true;
  }

  // Player Stats
  async createPlayerStats(stats: InsertPlayerStats): Promise<PlayerStats> {
    const [newStats] = await db.insert(playerStats).values(stats).returning();
    return newStats;
  }

  async getPlayerStats(id: number): Promise<PlayerStats | undefined> {
    const [stats] = await db.select().from(playerStats).where(eq(playerStats.id, id));
    return stats;
  }

  async getPlayerStatsByInnings(inningsId: number): Promise<(PlayerStats & { player: Player })[]> {
    const inningsStats = await db.select().from(playerStats)
      .where(eq(playerStats.inningsId, inningsId));

    const result: (PlayerStats & { player: Player })[] = [];
    
    for (const stats of inningsStats) {
      const [player] = await db.select().from(players).where(eq(players.id, stats.playerId));
      if (player) {
        result.push({ ...stats, player });
      }
    }
    
    return result;
  }

  async updatePlayerStats(id: number, stats: Partial<PlayerStats>): Promise<PlayerStats | undefined> {
    const [updatedStats] = await db.update(playerStats).set(stats).where(eq(playerStats.id, id)).returning();
    return updatedStats;
  }

  async getCurrentBatsmen(inningsId: number): Promise<(PlayerStats & { player: Player })[]> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    const [inningsData] = await db.select().from(innings).where(eq(innings.id, inningsId));
    
    if (!inningsData) return [];
    
    // Filter for batting team players who are not out
    const battingTeamPlayers = inningsStats.filter(s => 
      s.player.teamId === inningsData.battingTeamId && !s.isOut
    );
    
    // Sort by strike status first (on strike first), then by balls faced (descending)
    battingTeamPlayers.sort((a, b) => {
      // First priority: on strike batsman comes first
      const aOnStrike = a.isOnStrike ? 1 : 0;
      const bOnStrike = b.isOnStrike ? 1 : 0;
      if (aOnStrike !== bOnStrike) {
        return bOnStrike - aOnStrike; // On strike first
      }
      
      // Second priority: most active batsman (balls faced)
      const aBalls = a.ballsFaced || 0;
      const bBalls = b.ballsFaced || 0;
      if (aBalls === bBalls) {
        return a.playerId - b.playerId; // Consistent ordering by player ID
      }
      return bBalls - aBalls; // Most active first
    });
    
    // If no actual balls have been bowled, return the two batsmen with ballsFaced = -1 (selected openers)
    if (battingTeamPlayers.every(b => (b.ballsFaced || 0) <= 0)) {
      const selectedBatsmen = battingTeamPlayers.filter(b => (b.ballsFaced || 0) === -1);
      
      if (selectedBatsmen.length === 2) {
        // Reset their ballsFaced to 0 for accurate statistics display
        selectedBatsmen.forEach(b => b.ballsFaced = 0);
        // Return the two selected openers, sorted by strike status (on strike first)
        return selectedBatsmen.sort((a, b) => (b.isOnStrike ? 1 : 0) - (a.isOnStrike ? 1 : 0));
      }
    }
    
    // Return first 2 batting team players (current batsmen)
    return battingTeamPlayers.slice(0, 2);
  }

  async getCurrentBowler(inningsId: number): Promise<(PlayerStats & { player: Player }) | undefined> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    const [inningsData] = await db.select().from(innings).where(eq(innings.id, inningsId));
    
    if (!inningsData) return undefined;
    
    // Filter for bowling team players
    const bowlingTeamPlayers = inningsStats.filter(s => 
      s.player.teamId === inningsData.bowlingTeamId
    );
    
    // If there's a current bowler set in the innings, use that
    if (inningsData.currentBowlerId) {
      const currentBowler = bowlingTeamPlayers.find(s => s.playerId === inningsData.currentBowlerId);
      if (currentBowler) {
        return currentBowler;
      }
    }
    
    // Get the most recent ball to find who bowled it
    const recentBalls = await this.getRecentBalls(inningsId, 1);
    
    if (recentBalls.length > 0) {
      // Return the bowler who bowled the most recent ball
      const lastBowlerId = recentBalls[0].bowlerId;
      const currentBowler = bowlingTeamPlayers.find(s => s.playerId === lastBowlerId);
      if (currentBowler) {
        return currentBowler;
      }
    }
    
    // Fallback: Return the bowler who has bowled balls in the current over (not completed 6 balls)
    return bowlingTeamPlayers.find(s => (s.ballsBowled ?? 0) > 0 && (s.ballsBowled ?? 0) % 6 !== 0) ||
           bowlingTeamPlayers.find(s => (s.ballsBowled ?? 0) > 0) ||
           bowlingTeamPlayers[0]; // Default to first bowler if no one has bowled yet
  }

  // ICC-Compliant Statistics Updates
  async updateBatsmanStatsWithICCRules(inningsId: number, batsmanId: number, runs: number, isValidBall: boolean, isWicket: boolean, extraType?: string | null): Promise<void> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    const batsmanStats = inningsStats.find(s => s.playerId === batsmanId);
    
    if (batsmanStats) {
      const updates: Partial<PlayerStats> = {};
      
      // Only credit runs to batsman if not extras (bye/leg-bye don't count)
      if (extraType !== 'bye' && extraType !== 'legbye' && extraType !== 'wide') {
        updates.runs = (batsmanStats.runs || 0) + runs;
        
        // Update boundary counts
        if (runs === 4) updates.fours = (batsmanStats.fours || 0) + 1;
        if (runs === 6) updates.sixes = (batsmanStats.sixes || 0) + 1;
      }
      
      // ICC Rule: Batsman faces ball only if it's not a wide
      if (isValidBall && extraType !== 'wide') {
        updates.ballsFaced = Math.max(0, (batsmanStats.ballsFaced || 0) + 1);
      }
      
      // Handle dismissal
      if (isWicket) {
        updates.isOut = true;
      }
      
      await this.updatePlayerStats(batsmanStats.id, updates);
    }
  }

  async updateBowlerStatsWithICCRules(inningsId: number, bowlerId: number, totalRuns: number, isValidBall: boolean, isWicket: boolean, extraType?: string | null): Promise<void> {
    const inningsStats = await this.getPlayerStatsByInnings(inningsId);
    const bowlerStats = inningsStats.find(s => s.playerId === bowlerId);
    
    if (bowlerStats) {
      const updates: Partial<PlayerStats> = {
        runsConceded: (bowlerStats.runsConceded || 0) + totalRuns
      };
      
      // ICC Rule: Only valid balls count towards balls bowled
      if (isValidBall) {
        const newBallsBowled = (bowlerStats.ballsBowled || 0) + 1;
        updates.ballsBowled = newBallsBowled;
        updates.oversBowled = Math.floor(newBallsBowled / 6);
      }
      
      // Update wicket count
      if (isWicket) {
        updates.wicketsTaken = (bowlerStats.wicketsTaken || 0) + 1;
      }
      
      // ICC Rule: Count wide balls and no balls separately
      if (extraType === 'wide') {
        updates.wideBalls = (bowlerStats.wideBalls || 0) + 1;
      }
      if (extraType === 'noball') {
        updates.noBalls = (bowlerStats.noBalls || 0) + 1;
      }
      
      await this.updatePlayerStats(bowlerStats.id, updates);
    }
  }

  // Clear Match Data
  async clearMatchDataLegacy(matchId: number): Promise<boolean> {
    try {
      // Get all innings for this match
      const matchInnings = await db.select().from(innings).where(eq(innings.matchId, matchId));
      
      if (matchInnings.length === 0) {
        console.log('No innings found for match', matchId);
        return true; // Already clear
      }

      // Delete all balls for all innings in this match
      for (const inning of matchInnings) {
        await db.delete(balls).where(eq(balls.inningsId, inning.id));
        console.log(`Cleared balls for innings ${inning.id}`);
      }

      // Reset all player statistics to initial state
      for (const inning of matchInnings) {
        const inningsStats = await db.select().from(playerStats).where(eq(playerStats.inningsId, inning.id));
        
        for (const stats of inningsStats) {
          await db.update(playerStats).set({
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            ballsBowled: 0,
            runsConceded: 0,
            wicketsTaken: 0,
            oversBowled: 0,
            isOut: false,
            isOnStrike: false,
            dismissalType: null,
            dismissalBall: null,
            fielderId: null
          }).where(eq(playerStats.id, stats.id));
        }
        console.log(`Reset player stats for innings ${inning.id}`);
      }

      // Reset innings totals
      for (const inning of matchInnings) {
        await db.update(innings).set({
          totalRuns: 0,
          totalBalls: 0,
          totalWickets: 0,
          totalOvers: 0,
          currentBowlerId: null,
          isCompleted: false
        }).where(eq(innings.id, inning.id));
        console.log(`Reset innings totals for innings ${inning.id}`);
      }

      // Reset match status to not started
      await db.update(matches).set({
        status: 'not_started',
        currentInningsId: null
      }).where(eq(matches.id, matchId));

      console.log(`Successfully cleared all data for match ${matchId}`);
      return true;
    } catch (error) {
      console.error('Error clearing match data:', error);
      return false;
    }
  }

  // Live Match Data
  async getLiveMatchData(matchId: number): Promise<LiveMatchData | undefined> {
    const matchWithTeams = await this.getMatchWithTeams(matchId);
    if (!matchWithTeams) return undefined;

    const currentInnings = await this.getCurrentInnings(matchId);
    if (!currentInnings) return undefined;

    const recentBalls = await this.getRecentBalls(currentInnings.id, 10);
    const currentBatsmen = await this.getCurrentBatsmen(currentInnings.id);
    const currentBowler = await this.getCurrentBowler(currentInnings.id);

    return {
      match: matchWithTeams,
      currentInnings,
      recentBalls,
      currentBatsmen,
      currentBowler: currentBowler!
    };
  }

  // Match Reset - Clear all balls and reset player stats
  async resetMatchData(matchId: number): Promise<void> {
    const currentInnings = await this.getCurrentInnings(matchId);
    if (!currentInnings) return;

    // Delete all balls for this innings
    await db.delete(balls).where(eq(balls.inningsId, currentInnings.id));

    // Reset innings totals
    await db.update(innings).set({
      totalRuns: 0,
      totalBalls: 0,
      totalWickets: 0,
      totalOvers: 0
    }).where(eq(innings.id, currentInnings.id));

    // Reset all player stats for this innings
    const inningsStats = await this.getPlayerStatsByInnings(currentInnings.id);
    for (const stat of inningsStats) {
      await this.updatePlayerStats(stat.id, {
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        ballsBowled: 0,
        runsConceded: 0,
        wicketsTaken: 0,
        oversBowled: 0,
        isOut: false,
        isOnStrike: false
      });
    }

    // Set the initial strike for batsmen (first two batsmen, first one on strike)
    const battingTeamPlayers = inningsStats.filter(s => s.player.teamId === currentInnings.battingTeamId);
    if (battingTeamPlayers.length >= 2) {
      await this.updatePlayerStats(battingTeamPlayers[0].id, { isOnStrike: true });
      await this.updatePlayerStats(battingTeamPlayers[1].id, { isOnStrike: false });
    }

    console.log(`Match ${matchId} data reset successfully`);
  }

  // Cricket Logic - Strike Rotation
  /**
   * ICC Rule 18: Strike rotation on odd runs
   */
  async updateStrikeRotation(inningsId: number, batsmanId: number, runs: number, isExtra: boolean): Promise<void> {
    // ICC Rule: On odd runs (1, 3, 5), batsmen cross over
    // On even runs (0, 2, 4, 6), batsmen stay in same positions
    // On extras (wide, no-ball), no strike rotation unless runs are taken
    
    if (isExtra && runs === 0) {
      // No strike rotation on extras with no runs
      return;
    }
    
    const shouldRotateStrike = runs % 2 === 1; // Odd runs = strike rotation
    
    if (shouldRotateStrike) {
      // Get current batsmen
      const currentBatsmen = await this.getCurrentBatsmen(inningsId);
      
      if (currentBatsmen.length >= 2) {
        // Find the striker (who faced this ball) and non-striker
        const striker = currentBatsmen.find(b => b.playerId === batsmanId);
        const nonStriker = currentBatsmen.find(b => b.playerId !== batsmanId);
        
        if (striker && nonStriker) {
          // Switch their strike status
          await this.updatePlayerStats(striker.id, { isOnStrike: false });
          await this.updatePlayerStats(nonStriker.id, { isOnStrike: true });
          
          console.log(`Strike rotation: ${nonStriker.player.name} is now on strike (after ${runs} run${runs === 1 ? '' : 's'})`);
        }
      }
    }
  }

  async reverseStrikeRotation(inningsId: number): Promise<void> {
    // Reverse the current strike rotation by swapping the strike status
    const currentBatsmen = await this.getCurrentBatsmen(inningsId);
    
    if (currentBatsmen.length >= 2) {
      const striker = currentBatsmen.find(b => b.isOnStrike);
      const nonStriker = currentBatsmen.find(b => !b.isOnStrike);
      
      if (striker && nonStriker) {
        // Switch their strike status back
        await this.updatePlayerStats(striker.id, { isOnStrike: false });
        await this.updatePlayerStats(nonStriker.id, { isOnStrike: true });
        
        console.log(`Strike rotation reversed: ${nonStriker.player.name} is now on strike (undo)`);
      }
    }
  }

  async clearMatchData(matchId: number): Promise<void> {
    // Find all innings for this match
    const matchInnings = await db.select().from(innings).where(eq(innings.matchId, matchId));
    const inningsIds = matchInnings.map(i => i.id);

    // Delete all balls for these innings
    for (const inningsId of inningsIds) {
      await db.delete(balls).where(eq(balls.inningsId, inningsId));
    }

    // Delete all player stats for these innings
    for (const inningsId of inningsIds) {
      await db.delete(playerStats).where(eq(playerStats.inningsId, inningsId));
    }

    // Delete all innings for this match
    await db.delete(innings).where(eq(innings.matchId, matchId));

    console.log(`Match ${matchId} data cleared successfully`);
  }

  // Statistics Methods Implementation
  async getMatchStatistics(matchId: number | null, timeRange: string): Promise<any> {
    try {
      const stats = {
        totalMatches: 0,
        totalRuns: 0,
        totalWickets: 0,
        totalBoundaries: 0,
        fours: 0,
        sixes: 0,
        team1Runs: 0,
        team2Runs: 0,
        team1Wickets: 0,
        team2Wickets: 0,
        team1Boundaries: 0,
        team2Boundaries: 0,
        team1RunRate: '0.00',
        team2RunRate: '0.00',
        overallRunRate: '0.00',
        runsPerOver: [],
        wicketsPerOver: [],
        boundaryStats: [
          { type: 'Fours', count: 0 },
          { type: 'Sixes', count: 0 }
        ],
        bowlerStats: [],
        batsmanStats: []
      };

      // If matchId is specified, get stats for that match only
      let matchesData;
      if (matchId) {
        matchesData = await db.select().from(matches).where(eq(matches.id, matchId));
      } else {
        matchesData = await db.select().from(matches);
      }
      
      stats.totalMatches = matchesData.length;

      for (const match of matchesData) {
        const matchInnings = await db.select().from(innings).where(eq(innings.matchId, match.id));
        
        for (const inning of matchInnings) {
          const inningBalls = await db.select().from(balls).where(eq(balls.inningsId, inning.id));
          const inningStats = await db.select().from(playerStats).where(eq(playerStats.inningsId, inning.id));
          
          // Calculate runs and wickets
          const runs = inningBalls.reduce((sum, ball) => sum + (ball.runs || 0), 0);
          const wickets = inningBalls.filter(ball => ball.isWicket).length;
          const boundaries = inningBalls.filter(ball => ball.runs === 4 || ball.runs === 6).length;
          const fours = inningBalls.filter(ball => ball.runs === 4).length;
          const sixes = inningBalls.filter(ball => ball.runs === 6).length;
          
          stats.totalRuns += runs;
          stats.totalWickets += wickets;
          stats.totalBoundaries += boundaries;
          stats.fours += fours;
          stats.sixes += sixes;
          
          // Team-specific stats
          if (inning.battingTeamId === match.team1Id) {
            stats.team1Runs += runs;
            stats.team1Wickets += wickets;
            stats.team1Boundaries += boundaries;
          } else {
            stats.team2Runs += runs;
            stats.team2Wickets += wickets;
            stats.team2Boundaries += boundaries;
          }
        }
      }

      // Update boundary stats
      stats.boundaryStats[0].count = stats.fours;
      stats.boundaryStats[1].count = stats.sixes;

      return stats;
    } catch (error) {
      console.error('Error calculating match statistics:', error);
      return {};
    }
  }

  async getArchivedMatches(filters: { search?: string; status?: string; sort?: string }): Promise<any[]> {
    try {
      const allMatches = await this.getAllMatches();
      
      return allMatches.map(match => ({
        ...match,
        totalRuns: 0, // Calculate from balls if needed
        totalWickets: 0, // Calculate from wickets if needed  
        totalOvers: 0, // Calculate from balls if needed
        totalBoundaries: 0, // Calculate from boundaries if needed
        runRate: '0.00', // Calculate run rate if needed
        winner: null, // Determine winner if needed
        highlights: [] // Add match highlights if available
      }));
    } catch (error) {
      console.error('Error fetching archived matches:', error);
      return [];
    }
  }

  async exportMatchData(matchId: number): Promise<any> {
    try {
      const match = await this.getMatchWithDetails(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      const matchInnings = await db.select().from(innings).where(eq(innings.matchId, matchId));
      const exportData = {
        match,
        innings: [],
        balls: [],
        playerStats: []
      };

      for (const inning of matchInnings) {
        const inningBalls = await db.select().from(balls).where(eq(balls.inningsId, inning.id));
        const inningStats = await db.select().from(playerStats).where(eq(playerStats.inningsId, inning.id));
        
        exportData.innings.push(inning);
        exportData.balls.push(...inningBalls);
        exportData.playerStats.push(...inningStats);
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting match data:', error);
      return {};
    }
  }

  async getPlayerStatistics(filters: { search?: string; team?: string; role?: string }): Promise<any[]> {
    try {
      const allPlayers = await this.getAllPlayers();
      
      return allPlayers.map(player => ({
        ...player,
        stats: {
          totalMatches: 0,
          totalRuns: 0,
          totalWickets: 0,
          battingAverage: 0,
          strikeRate: 0,
          highestScore: 0,
          bestBowling: '0/0',
          boundaries: 0,
          economyRate: 0,
          consistency: 0,
          recentForm: 0,
          trophies: 0
        }
      }));
    } catch (error) {
      console.error('Error fetching player statistics:', error);
      return [];
    }
  }

  async getDetailedPlayerStats(playerId: number): Promise<any> {
    try {
      const player = await this.getPlayer(playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      return {
        ...player,
        stats: {
          totalMatches: 0,
          totalRuns: 0,
          totalWickets: 0,
          battingAverage: 0,
          strikeRate: 0,
          highestScore: 0,
          bestBowling: '0/0',
          boundaries: 0,
          economyRate: 0,
          consistency: 0,
          recentForm: 0,
          trophies: 0
        },
        matchHistory: [] // Recent match performance data
      };
    } catch (error) {
      console.error('Error fetching detailed player stats:', error);
      return {};
    }
  }

  // Player-Franchise Links
  async createPlayerFranchiseLink(link: InsertPlayerFranchiseLink): Promise<PlayerFranchiseLink> {
    try {
      const [newLink] = await db.insert(playerFranchiseLinks)
        .values(link)
        .returning();
      return newLink;
    } catch (error) {
      console.error('Error creating player-franchise link:', error);
      throw new Error('Failed to create player-franchise link');
    }
  }

  async getPlayerFranchiseLinks(playerId: number): Promise<PlayerFranchiseLink[]> {
    try {
      return await db.select()
        .from(playerFranchiseLinks)
        .where(eq(playerFranchiseLinks.playerId, playerId))
        .where(eq(playerFranchiseLinks.isActive, true));
    } catch (error) {
      console.error('Error fetching player-franchise links:', error);
      return [];
    }
  }

  async removePlayerFranchiseLink(playerId: number, franchiseId: number): Promise<boolean> {
    try {
      const result = await db.delete(playerFranchiseLinks)
        .where(and(
          eq(playerFranchiseLinks.playerId, playerId),
          eq(playerFranchiseLinks.franchiseId, franchiseId)
        ));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error removing player-franchise link:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
