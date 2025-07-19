import { 
  teams, players, matches, innings, balls, playerStats,
  type Team, type Player, type Match, type Innings, type Ball, type PlayerStats,
  type InsertTeam, type InsertPlayer, type InsertMatch, type InsertInnings, type InsertBall, type InsertPlayerStats,
  type MatchWithTeams, type InningsWithStats, type LiveMatchData
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Teams
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;

  // Players
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByTeam(teamId: number): Promise<Player[]>;
  updatePlayer(id: number, player: Partial<Player>): Promise<Player | undefined>;

  // Matches
  createMatch(match: InsertMatch): Promise<Match>;
  getMatch(id: number): Promise<Match | undefined>;
  getMatchWithTeams(id: number): Promise<MatchWithTeams | undefined>;
  updateMatch(id: number, match: Partial<Match>): Promise<Match | undefined>;
  getAllMatches(): Promise<MatchWithTeams[]>;

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

  async getAllMatches(): Promise<MatchWithTeams[]> {
    const allMatches = await db.select().from(matches);
    const result: MatchWithTeams[] = [];
    
    for (const match of allMatches) {
      const [team1] = await db.select().from(teams).where(eq(teams.id, match.team1Id));
      const [team2] = await db.select().from(teams).where(eq(teams.id, match.team2Id));
      
      if (team1 && team2) {
        result.push({ ...match, team1, team2 });
      }
    }
    
    return result;
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
    // Check cricket rule: same bowler cannot bowl consecutive overs
    await this.validateNonConsecutiveBowling(ball.inningsId, ball.bowlerId, ball.overNumber);
    
    const [newBall] = await db.insert(balls).values({
      ...ball,
      createdAt: new Date()
    }).returning();
    return newBall;
  }

  async validateNonConsecutiveBowling(inningsId: number, bowlerId: number, currentOver: number): Promise<void> {
    if (currentOver <= 1) return; // First over is always allowed
    
    // Get the last ball of the previous over
    const [previousOverLastBall] = await db.select().from(balls)
      .where(eq(balls.inningsId, inningsId))
      .where(eq(balls.overNumber, currentOver - 1))
      .orderBy(desc(balls.ballNumber))
      .limit(1);
    
    if (previousOverLastBall && previousOverLastBall.bowlerId === bowlerId) {
      throw new Error(`Cricket Rule Violation: Same bowler cannot bowl consecutive overs. Please select a different bowler for over ${currentOver}.`);
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

  // Clear Match Data
  async clearMatchData(matchId: number): Promise<boolean> {
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
}

export const storage = new DatabaseStorage();
