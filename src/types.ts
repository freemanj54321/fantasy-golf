export enum AppView {
  DASHBOARD,
  MASTERS,
  RANKINGS,
  DRAFT,
  TEAMS,
  ADMIN,
}

export const PLAYERS_PER_TEAM = 3;

export interface RoundScores {
  r1?: string | number | null;
  r2?: string | number | null;
  r3?: string | number | null;
  r4?: string | number | null;
}

export interface RoundTeeTimes {
  r1?: string | null;
  r2?: string | null;
  r3?: string | null;
  r4?: string | null;
}

export interface Golfer {
  id: string;
  name: string;
  country?: string;
  rank: number;
  odds?: string;
  // Live data - optional during draft
  position?: number | string;
  status?: string | null;
  topar?: number | string;
  thru?: string;
  today?: string;
  // Round-by-round scores (score relative to par for each round)
  roundScores?: RoundScores;
  // Round-by-round tee times
  roundTeeTimes?: RoundTeeTimes;
  // Starting time
  teeTime?: string | null;
}

export interface Team {
  id: string;
  teamId: string; // Unique team identifier for cross-year reporting
  name: string;
  ownerEmail?: string; // Legacy — no longer required
  ownerId?: string; // Legacy — no longer required
  logoUrl?: string;
  roster: Golfer[];
  year: number;
  draftOrder?: number; // Order in the draft (0-indexed)
  players?: Golfer[]; // Legacy support
}

export interface DataSource {
  name: string;
  url?: string;
}

export interface LeagueSettings {
  year: number;
  teamCount: number;
  playersPerTeam: number;
  draftStatus: 'pre-draft' | 'in-progress' | 'complete';
  tournamentLogoUrl?: string;
}

// FantasyGolf-Results: Individual player round record for detailed reporting
export interface FantasyGolfPlayerRoundResult {
  // Player info
  firstName: string;
  lastName: string;
  playerId: string;
  isAmateur: boolean;

  // Tournament/round info
  tournId: string;
  year: number;
  roundId: number;

  // Score info
  position: string | number | null;
  status?: string | null;
  strokes: number | null;
  total: number | null; // Total strokes through all rounds
  totalToPar: string | number | null;
  roundScore?: number | string | null;
  thru: string | number | null;
  teeTime: string | null;

  // Team info
  teamId: string;
  teamName: string;
  ownerId: string;
  ownerName: string;

  // Metadata
  lastUpdated: Date;
}

// FantasyGolf-Results: Stored player result for league reporting (legacy/snapshot)
export interface FantasyGolfPlayerResult {
  playerId: string;
  name: string;
  rank: number;
  position: string | number | null;
  totalToPar: string | number | null;
  thru: string | number | null;
  roundScores: RoundScores;
  isCut: boolean;
}

// FantasyGolf-Results: Stored team result for league reporting (legacy/snapshot)
export interface FantasyGolfTeamResult {
  teamId: string;
  teamName: string;
  ownerEmail: string;
  teamScore: number | null;
  teamPosition: number | null;
  isCut: boolean;
  players: FantasyGolfPlayerResult[];
}

// FantasyGolf-Results: Full snapshot document (legacy/snapshot)
export interface FantasyGolfResultSnapshot {
  tournId: string;
  tournamentName?: string;
  year: number;
  roundId: number;
  teams: FantasyGolfTeamResult[];
  lastUpdated: Date;
}

// ============================================================
// Champions Locker Room — Season Records
// ============================================================

export interface PlayerSeasonRecord {
  playerId: string;
  name: string;
  finalPosition: string | number | null; // "1", "T5", "CUT", "WD"
  totalToPar: string | number | null;
  madeCut: boolean;       // survived to R3+
  isWithdrawn: boolean;
  roundScores: RoundScores;
}

export interface TeamSeasonRecord {
  teamId: string;
  teamName: string;
  finalPosition: number;      // 1st, 2nd, 3rd…
  totalScore: number | null;  // Combined team totalToPar
  roundScores: RoundScores;   // Per-round combined team score
  dailyWins: number;          // Count of rounds won (lowest team score that day)
  dailyWinRounds: number[];   // Which specific rounds: [1, 3]
  overallWin: boolean;        // Did they win the league championship?
  cutsEarned: number;         // Number of players who made the cut
  teamMadeCut?: boolean;      // True if ≥2 players survived the tournament cut; undefined = legacy record (treat as true)
  draftOrder: number;         // 0-indexed draft pick position
  players: PlayerSeasonRecord[];
}

export interface SeasonTournamentWinner {
  name: string;
  playerId?: string;
  totalToPar: string | number | null;
  country?: string;
}

export interface SeasonRecord {
  year: number;
  tournamentId: string;
  tournamentName: string;
  tournamentWinner: SeasonTournamentWinner | null; // Actual PGA Tour winner
  teams: TeamSeasonRecord[];  // Ordered by finalPosition ascending
  lockedAt?: string;          // ISO timestamp — set when admin finalizes
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  id: string;
  timestamp: Date | { seconds: number; nanoseconds: number } | any; // Firestore Timestamp
  type: string;
  status: 'success' | 'error' | 'no-op';
  message: string;
  tournamentId?: string;
  roundId?: number;
  details?: Record<string, unknown>;
}
