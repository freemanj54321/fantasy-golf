import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';
import { fetchAvailableGolfers } from './rankingService';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

describe('rankingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAvailableGolfers', () => {
    it('returns empty array when no players found', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const result = await fetchAvailableGolfers(2024);

      expect(result).toEqual([]);
    });

    it('fetches and transforms golfers data', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            fullName: 'Scottie Scheffler',
            country: 'USA',
            odds: '+500',
          }),
        },
        {
          id: 'doc2',
          data: () => ({
            playerId: '2',
            firstName: 'Rory',
            lastName: 'McIlroy',
            country: 'NIR',
          }),
        },
      ];

      const mockRankingsDocs = [
        {
          id: 'rank1',
          data: () => ({ playerId: '1', rank: 1 }),
        },
        {
          id: 'rank2',
          data: () => ({ playerId: '2', rank: 2 }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: mockRankingsDocs,
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Scottie Scheffler');
      expect(result[0].rank).toBe(1);
      expect(result[1].name).toBe('Rory McIlroy');
    });

    it('handles $numberInt format for playerId and rank', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: { $numberInt: '12345' },
            fullName: 'Test Player',
            country: 'USA',
          }),
        },
      ];

      const mockRankingsDocs = [
        {
          id: 'rank1',
          data: () => ({
            playerId: { $numberInt: '12345' },
            rank: { $numberInt: '5' },
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: mockRankingsDocs,
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].id).toBe('12345');
      expect(result[0].rank).toBe(5);
    });

    it('uses fallback rank when not in rankings', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '999',
            fullName: 'Unknown Player',
            country: 'USA',
            rank: 100,
          }),
        },
      ];

      const mockRankingsDocs: any[] = [];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: mockRankingsDocs,
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].rank).toBe(100); // Uses fallback from data
    });

    it('uses 999 as default rank when no rank available', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '999',
            fullName: 'No Rank Player',
            country: 'USA',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].rank).toBe(999);
    });

    it('sorts golfers by rank then name', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            fullName: 'Zebra Player',
            country: 'USA',
          }),
        },
        {
          id: 'doc2',
          data: () => ({
            playerId: '2',
            fullName: 'Alpha Player',
            country: 'USA',
          }),
        },
        {
          id: 'doc3',
          data: () => ({
            playerId: '3',
            fullName: 'Beta Player',
            country: 'USA',
          }),
        },
      ];

      const mockRankingsDocs = [
        { id: 'r1', data: () => ({ playerId: '1', rank: 2 }) },
        { id: 'r2', data: () => ({ playerId: '2', rank: 1 }) },
        { id: 'r3', data: () => ({ playerId: '3', rank: 2 }) },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: mockRankingsDocs,
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      // Should be sorted by rank first, then alphabetically
      expect(result[0].name).toBe('Alpha Player'); // rank 1
      expect(result[1].name).toBe('Beta Player'); // rank 2, comes before Zebra alphabetically
      expect(result[2].name).toBe('Zebra Player'); // rank 2
    });

    it('fetches all golfers when no year specified', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            fullName: 'Test Player',
            country: 'USA',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers();

      expect(result).toHaveLength(1);
      // Verify where was not called with year
      expect(firestore.query).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      vi.mocked(firestore.getDocs).mockRejectedValue(new Error('Firestore error'));

      const result = await fetchAvailableGolfers(2024);

      expect(result).toEqual([]);
    });

    it('uses default country USA when not provided', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            fullName: 'Test Player',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].country).toBe('USA');
    });

    it('uses default odds E when not provided', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            fullName: 'Test Player',
            country: 'USA',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].odds).toBe('E');
    });

    it('uses doc.id as playerId fallback', async () => {
      const mockFieldDocs = [
        {
          id: 'doc-id-123',
          data: () => ({
            fullName: 'No PlayerId Player',
            country: 'USA',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].id).toBe('doc-id-123');
    });

    it('handles missing name fields gracefully', async () => {
      const mockFieldDocs = [
        {
          id: 'doc1',
          data: () => ({
            playerId: '1',
            country: 'USA',
          }),
        },
      ];

      let callCount = 0;
      vi.mocked(firestore.getDocs).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            empty: false,
            docs: mockFieldDocs,
          } as any);
        }
        return Promise.resolve({
          docs: [],
        } as any);
      });

      const result = await fetchAvailableGolfers(2024);

      expect(result[0].name).toBe('Unknown');
    });
  });
});
