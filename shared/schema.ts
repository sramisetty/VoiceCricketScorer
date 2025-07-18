import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  logo: text("logo"),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  teamId: integer("team_id").references(() => teams.id),
  role: text("role").notNull(), // batsman, bowler, allrounder, wicketkeeper
  battingOrder: integer("batting_order"),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  team1Id: integer("team1_id").references(() => teams.id).notNull(),
  team2Id: integer("team2_id").references(() => teams.id).notNull(),
  tossWinnerId: integer("toss_winner_id").references(() => teams.id),
  tossDecision: text("toss_decision"), // bat, bowl
  matchType: text("match_type").notNull(), // T20, ODI, Test
  overs: integer("overs").notNull(),
  status: text("status").notNull().default("setup"), // setup, live, completed
  currentInnings: integer("current_innings").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const innings = pgTable("innings", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  battingTeamId: integer("batting_team_id").references(() => teams.id).notNull(),
  bowlingTeamId: integer("bowling_team_id").references(() => teams.id).notNull(),
  inningsNumber: integer("innings_number").notNull(),
  totalRuns: integer("total_runs").default(0),
  totalWickets: integer("total_wickets").default(0),
  totalOvers: integer("total_overs").default(0),
  totalBalls: integer("total_balls").default(0),
  extras: jsonb("extras").default({}), // {wides: 0, noballs: 0, byes: 0, legbyes: 0}
  isCompleted: boolean("is_completed").default(false),
});

export const balls = pgTable("balls", {
  id: serial("id").primaryKey(),
  inningsId: integer("innings_id").references(() => innings.id).notNull(),
  overNumber: integer("over_number").notNull(),
  ballNumber: integer("ball_number").notNull(),
  batsmanId: integer("batsman_id").references(() => players.id).notNull(),
  bowlerId: integer("bowler_id").references(() => players.id).notNull(),
  runs: integer("runs").default(0),
  isWicket: boolean("is_wicket").default(false),
  wicketType: text("wicket_type"), // bowled, caught, lbw, etc.
  extraType: text("extra_type"), // wide, noball, bye, legbye
  extraRuns: integer("extra_runs").default(0),
  commentary: text("commentary"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  inningsId: integer("innings_id").references(() => innings.id).notNull(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  runs: integer("runs").default(0),
  ballsFaced: integer("balls_faced").default(0),
  fours: integer("fours").default(0),
  sixes: integer("sixes").default(0),
  isOut: boolean("is_out").default(false),
  isOnStrike: boolean("is_on_strike").default(false),
  // bowling stats
  oversBowled: integer("overs_bowled").default(0),
  ballsBowled: integer("balls_bowled").default(0),
  runsConceded: integer("runs_conceded").default(0),
  wicketsTaken: integer("wickets_taken").default(0),
});

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertInningsSchema = createInsertSchema(innings).omit({ id: true });
export const insertBallSchema = createInsertSchema(balls).omit({ id: true, createdAt: true });
export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({ id: true });

// Types
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Innings = typeof innings.$inferSelect;
export type Ball = typeof balls.$inferSelect;
export type PlayerStats = typeof playerStats.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertInnings = z.infer<typeof insertInningsSchema>;
export type InsertBall = z.infer<typeof insertBallSchema>;
export type InsertPlayerStats = z.infer<typeof insertPlayerStatsSchema>;

// Complex types for API responses
export type MatchWithTeams = Match & {
  team1: Team;
  team2: Team;
  tossWinner?: Team;
};

export type InningsWithStats = Innings & {
  battingTeam: Team;
  bowlingTeam: Team;
  balls: Ball[];
  playerStats: (PlayerStats & { player: Player })[];
};

export type LiveMatchData = {
  match: MatchWithTeams;
  currentInnings: InningsWithStats;
  recentBalls: (Ball & { batsman: Player; bowler: Player })[];
  currentBatsmen: (PlayerStats & { player: Player })[];
  currentBowler: PlayerStats & { player: Player };
};
