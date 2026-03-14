/**
 * Centralized Firebase Firestore collection names
 * This ensures consistency across the application and prevents typos
 */

export const COLLECTIONS = {
  PGA_SCHEDULE: 'PGA-Schedule',
  WORLD_RANKINGS: 'World-Rankings',
  TOURNAMENT_FIELD: 'Tournament-Field',
  TOURNAMENT_RESULTS: 'Tournament-Results',
  FANTASY_GOLF_TEAMS: 'FantasyGolf-Teams',
  TOURNAMENT_PLAYERS: 'Tournament-Players',
  SEASON_RECORDS: 'Season-Records',
} as const;

// Type-safe collection names
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Helper function to get collection reference path
export const getCollectionPath = (collection: CollectionName): string => {
  return collection;
};

// Export for backwards compatibility
export default COLLECTIONS;
