/**
 * TypeScript interfaces for Firebase Firestore documents
 * This ensures type safety across all Firebase operations
 */

// Base interface for documents with Firestore metadata
export interface FirestoreDocument {
  id: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// PGA Schedule
export interface PgaScheduleDocument extends FirestoreDocument {
  tournId: string;
  name: string;
  year: number;
  startDate?: string;
  endDate?: string;
  venue?: string;
  location?: string;
  purse?: number;
  courses?: string[];
}

// World Rankings
export interface WorldRankingDocument extends FirestoreDocument {
  playerId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  rank: number;
  avgPoints?: number;
  totalPoints?: number;
  eventsPlayed?: number;
  year: number;
}

// Tournament Field (Players in a tournament)
export interface TournamentFieldDocument extends FirestoreDocument {
  playerId: string;
  firstName: string;
  lastName: string;
  shortName?: string;
  country?: string;
  tournId: string;
  year: number;
  status?: string;
  startingHole?: number;
  teeTime?: string;
}

// Tournament Results (Leaderboard)
export interface TournamentResultDocument extends FirestoreDocument {
  playerId?: string;
  firstName: string;
  lastName: string;
  shortName?: string;
  country?: string;
  tournId: string;
  roundId: string;
  year: number;
  position?: number | string;
  score?: number;
  totalScore?: number;
  topar?: number | string;
  thru?: string;
  today?: string;
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
  total?: number;
  strokes?: number;
  earnings?: number;
  fedexPoints?: number;
}

// FantasyGolf Teams
export interface FantasyGolfTeamDocument extends FirestoreDocument {
  name: string;
  ownerEmail: string;
  logoUrl?: string;
  year: number;
  roster: TeamGolfer[];
  players?: TeamGolfer[]; // Legacy support
}

export interface TeamGolfer {
  id: string;
  name: string;
  country?: string;
  rank: number;
  odds?: string;
  position?: number | string;
  topar?: number | string;
  thru?: string;
  today?: string;
}

// User data (from Firebase Auth custom claims)
export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  customClaims?: {
    admin?: boolean;
    [key: string]: any;
  };
  disabled?: boolean;
}

// Batch operation result
export interface BatchOperationResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors?: Array<{
    item: any;
    error: string;
  }>;
}

// Query options
export interface FirestoreQueryOptions {
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  where?: Array<{
    field: string;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains';
    value: any;
  }>;
}

// Cache entry for query results
export interface FirestoreCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
