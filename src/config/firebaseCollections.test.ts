import { describe, it, expect } from 'vitest';
import COLLECTIONS, { getCollectionPath, CollectionName } from './firebaseCollections';

describe('firebaseCollections', () => {
  describe('COLLECTIONS constant', () => {
    it('has PGA_SCHEDULE collection', () => {
      expect(COLLECTIONS.PGA_SCHEDULE).toBe('PGA-Schedule');
    });

    it('has WORLD_RANKINGS collection', () => {
      expect(COLLECTIONS.WORLD_RANKINGS).toBe('World-Rankings');
    });

    it('has TOURNAMENT_FIELD collection', () => {
      expect(COLLECTIONS.TOURNAMENT_FIELD).toBe('Tournament-Field');
    });

    it('has TOURNAMENT_RESULTS collection', () => {
      expect(COLLECTIONS.TOURNAMENT_RESULTS).toBe('Tournament-Results');
    });

    it('has FANTASY_GOLF_TEAMS collection', () => {
      expect(COLLECTIONS.FANTASY_GOLF_TEAMS).toBe('FantasyGolf-Teams');
    });

    it('has TOURNAMENT_PLAYERS collection', () => {
      expect(COLLECTIONS.TOURNAMENT_PLAYERS).toBe('Tournament-Players');
    });

    it('is readonly (const assertion)', () => {
      // TypeScript will prevent mutation, but we can verify the values are strings
      expect(typeof COLLECTIONS.PGA_SCHEDULE).toBe('string');
      expect(typeof COLLECTIONS.WORLD_RANKINGS).toBe('string');
    });
  });

  describe('getCollectionPath', () => {
    it('returns the collection name unchanged', () => {
      expect(getCollectionPath(COLLECTIONS.PGA_SCHEDULE)).toBe('PGA-Schedule');
      expect(getCollectionPath(COLLECTIONS.WORLD_RANKINGS)).toBe('World-Rankings');
      expect(getCollectionPath(COLLECTIONS.TOURNAMENT_FIELD)).toBe('Tournament-Field');
      expect(getCollectionPath(COLLECTIONS.TOURNAMENT_RESULTS)).toBe('Tournament-Results');
      expect(getCollectionPath(COLLECTIONS.FANTASY_GOLF_TEAMS)).toBe('FantasyGolf-Teams');
      expect(getCollectionPath(COLLECTIONS.TOURNAMENT_PLAYERS)).toBe('Tournament-Players');
    });
  });

  describe('CollectionName type', () => {
    it('allows valid collection names', () => {
      const validName: CollectionName = 'PGA-Schedule';
      expect(validName).toBe('PGA-Schedule');
    });
  });

  describe('default export', () => {
    it('exports COLLECTIONS as default', () => {
      expect(COLLECTIONS).toBeDefined();
      expect(COLLECTIONS.PGA_SCHEDULE).toBe('PGA-Schedule');
    });
  });
});
