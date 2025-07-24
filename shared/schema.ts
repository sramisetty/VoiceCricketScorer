import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Franchises table - top level organization
export const franchises = pgTable("franchises", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 10 }).notNull(),
  logo: varchar("logo", { length: 500 }),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  established: date("established"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  website: varchar("website", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User authentication table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"), // global_admin, franchise_admin, scorer, viewer
  franchiseId: integer("franchise_id").references(() => franchises.id),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  logo: text("logo"),
  franchiseId: integer("franchise_id").references(() => franchises.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  franchiseId: integer("franchise_id").references(() => franchises.id).notNull(), // Players must belong to a franchise
  teamId: integer("team_id").references(() => teams.id), // Current team assignment (can change)
  role: text("role").notNull(), // batsman, bowler, allrounder, wicketkeeper
  battingOrder: integer("batting_order"),
  userId: integer("user_id").references(() => users.id), // Link to user account if player has one
  contactInfo: jsonb("contact_info"), // {email, phone, address}
  stats: jsonb("stats").default({
    totalMatches: 0,
    totalRuns: 0,
    totalWickets: 0,
    highestScore: 0,
    bestBowling: "0/0"
  }),
  availability: boolean("availability").default(true),
  preferredPosition: text("preferred_position"), // opening, middle, tail
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-Player link table to handle bidirectional relationships
export const userPlayerLinks = pgTable("user_player_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // Match name/title
  team1Id: integer("team1_id").references(() => teams.id).notNull(),
  team2Id: integer("team2_id").references(() => teams.id).notNull(),
  tossWinnerId: integer("toss_winner_id").references(() => teams.id),
  tossDecision: text("toss_decision"), // bat, bowl
  matchType: text("match_type").notNull(), // T20, ODI, Test, Practice, Inter_Franchise, Intra_Franchise
  overs: integer("overs").notNull(),
  venue: text("venue"),
  matchDate: timestamp("match_date"),
  status: text("status").notNull().default("setup"), // setup, live, completed, cancelled
  currentInnings: integer("current_innings").default(1),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  organizingFranchiseId: integer("organizing_franchise_id").references(() => franchises.id), // Franchise organizing the match
  isInterFranchise: boolean("is_inter_franchise").default(false), // Inter-franchise or intra-franchise match
  isPublic: boolean("is_public").default(true), // Whether match is visible to all users
  description: text("description"), // Optional match description
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  currentBowlerId: integer("current_bowler_id").references(() => players.id),
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
  wicketType: text("wicket_type"), // bowled, caught, lbw, run_out, stumped, hit_wicket, etc.
  fielderId: integer("fielder_id").references(() => players.id), // who caught it or ran out the batsman
  extraType: text("extra_type"), // wide, noball, bye, legbye, penalty
  extraRuns: integer("extra_runs").default(0),
  isShortRun: boolean("is_short_run").default(false), // ICC Rule: Short runs
  isDeadBall: boolean("is_dead_ball").default(false), // ICC Rule: Dead ball
  penaltyRuns: integer("penalty_runs").default(0), // ICC Rule: 5-run penalties
  batsmanCrossed: boolean("batsman_crossed").default(false), // For run out scenarios
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
  dismissalType: text("dismissal_type"), // ICC Rule: How player was dismissed
  dismissalBall: integer("dismissal_ball"), // Ball ID when dismissed
  fielderId: integer("fielder_id").references(() => players.id), // Fielder who dismissed
  // bowling stats
  oversBowled: integer("overs_bowled").default(0),
  ballsBowled: integer("balls_bowled").default(0),
  runsConceded: integer("runs_conceded").default(0),
  wicketsTaken: integer("wickets_taken").default(0),
  maidenOvers: integer("maiden_overs").default(0), // ICC Rule: Maiden overs
  wideBalls: integer("wide_balls").default(0), // ICC Rule: Wide balls bowled
  noBalls: integer("no_balls").default(0), // ICC Rule: No balls bowled
});

// Player pool for match creation
export const matchPlayerSelections = pgTable("match_player_selections", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  isCaptain: boolean("is_captain").default(false),
  isWicketkeeper: boolean("is_wicketkeeper").default(false),
  battingOrder: integer("batting_order"),
  isSelected: boolean("is_selected").default(true),
});

// Session management for authentication
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertFranchiseSchema = createInsertSchema(franchises).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInningsSchema = createInsertSchema(innings).omit({ id: true });
export const insertBallSchema = createInsertSchema(balls).omit({ id: true, createdAt: true });
export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({ id: true });
export const insertMatchPlayerSelectionSchema = createInsertSchema(matchPlayerSelections).omit({ id: true });
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({ id: true, createdAt: true });

// Types
export type Franchise = typeof franchises.$inferSelect;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Innings = typeof innings.$inferSelect;
export type Ball = typeof balls.$inferSelect;
export type PlayerStats = typeof playerStats.$inferSelect;
export type MatchPlayerSelection = typeof matchPlayerSelections.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;

export type InsertFranchise = z.infer<typeof insertFranchiseSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertInnings = z.infer<typeof insertInningsSchema>;
export type InsertBall = z.infer<typeof insertBallSchema>;
export type InsertPlayerStats = z.infer<typeof insertPlayerStatsSchema>;
export type InsertMatchPlayerSelection = z.infer<typeof insertMatchPlayerSelectionSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// Complex types for API responses
export type MatchWithTeams = Match & {
  team1: Team;
  team2: Team;
  tossWinner?: Team;
  createdByUser: User;
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

export type PlayerWithStats = Player & {
  user?: User;
  totalMatches: number;
  totalRuns: number;
  totalWickets: number;
  averageRuns: number;
  strikeRate: number;
  economyRate: number;
};

export type MatchWithDetails = Match & {
  team1: Team & { players: Player[] };
  team2: Team & { players: Player[] };
  createdByUser: User;
  selectedPlayers: (MatchPlayerSelection & { player: Player })[];
};

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  role: z.enum(["global_admin", "franchise_admin", "scorer", "viewer"]).default("viewer"),
  franchiseId: z.number().optional(),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
