import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RankingsPage from './RankingsPage';
import { YearProvider } from '../contexts/YearContext';
import * as firestore from 'firebase/firestore';
import React from 'react';

// Mock data
const mockRankings = [
  { id: '1', rank: 1, fullName: 'Scottie Scheffler', country: 'USA', year: 2024, points: 12.5, rankingChange: '+1' },
  { id: '2', rank: 2, fullName: 'Rory McIlroy', country: 'NIR', year: 2024, points: 10.2, rankingChange: '-1' },
  { id: '3', rank: 3, fullName: 'Jon Rahm', country: 'ESP', year: 2024, points: 9.8, rankingChange: '0' },
  { id: '4', rank: 4, fullName: 'Viktor Hovland', country: 'NOR', year: 2024, points: 8.5, rankingChange: '+2' },
  { id: '5', rank: 5, fullName: 'Patrick Cantlay', country: 'USA', year: 2024, points: 7.9, rankingChange: '-1' },
];

// Create many rankings for pagination testing
const createManyRankings = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i + 1}`,
    rank: i + 1,
    fullName: `Player ${i + 1}`,
    country: 'USA',
    year: 2024,
    points: 100 - i * 0.1,
    rankingChange: '0',
  }));
};

const renderWithProvider = (ui: React.ReactElement) => {
  localStorage.setItem('selectedYear', '2024');
  return render(
    <YearProvider>
      {ui}
    </YearProvider>
  );
};

describe('RankingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(firestore.collection).mockReturnValue({} as any);
    vi.mocked(firestore.query).mockReturnValue({} as any);
    vi.mocked(firestore.where).mockReturnValue({} as any);
    vi.mocked(firestore.orderBy).mockReturnValue({} as any);
    vi.mocked(firestore.limit).mockReturnValue({} as any);
  });

  describe('Rendering', () => {
    it('renders the page title', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      expect(screen.getByText('World Golf Rankings')).toBeInTheDocument();
    });

    it('displays the current year', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('2024 Season')).toBeInTheDocument();
      });
    });

    it('renders search input', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      expect(screen.getByPlaceholderText('Search player...')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      vi.mocked(firestore.getDocs).mockImplementation(() => new Promise(() => {}));

      renderWithProvider(<RankingsPage />);

      expect(screen.getByText('Loading Rankings...')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('displays rankings data', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
        expect(screen.getByText('Rory McIlroy')).toBeInTheDocument();
      });
    });

    it('displays rank numbers', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.slice(0, 1).map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('displays points with correct formatting', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.slice(0, 1).map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('12.5000')).toBeInTheDocument();
      });
    });

    it('shows no data message when empty', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: [],
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('No Data Available')).toBeInTheDocument();
        expect(screen.getByText(/No rankings were found/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on fetch failure', async () => {
      vi.mocked(firestore.getDocs).mockRejectedValue(new Error('Fetch failed'));

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch rankings for 2024.')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters rankings by search term', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search player...');
      fireEvent.change(searchInput, { target: { value: 'Rory' } });

      await waitFor(() => {
        expect(screen.getByText('Rory McIlroy')).toBeInTheDocument();
        expect(screen.queryByText('Scottie Scheffler')).not.toBeInTheDocument();
      });
    });

    it('search is case insensitive', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search player...');
      fireEvent.change(searchInput, { target: { value: 'RORY' } });

      await waitFor(() => {
        expect(screen.getByText('Rory McIlroy')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('sorts by rank ascending by default', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // First row is header, second row should be rank 1
        expect(rows[1]).toHaveTextContent('Scottie Scheffler');
      });
    });

    it('toggles sort direction on click', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      // Click rank header to toggle to descending
      const rankHeader = screen.getByText('Rank');
      fireEvent.click(rankHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // After descending sort, last rank should be first
        expect(rows[1]).toHaveTextContent('Patrick Cantlay');
      });
    });

    it('sorts by player name', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      const playerHeader = screen.getByText('Player');
      fireEvent.click(playerHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Jon Rahm should be first alphabetically
        expect(rows[1]).toHaveTextContent('Jon Rahm');
      });
    });

    it('sorts by points', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      const pointsHeader = screen.getByText('Points');
      fireEvent.click(pointsHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Lowest points first
        expect(rows[1]).toHaveTextContent('Patrick Cantlay');
      });
    });

    it('handles null/undefined values in sorting', async () => {
      const rankingsWithNull = [
        ...mockRankings,
        { id: '6', rank: 6, fullName: 'Test Player', country: 'USA', year: 2024, points: undefined, rankingChange: '0' },
      ];

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: rankingsWithNull.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });

      const pointsHeader = screen.getByText('Points');
      fireEvent.click(pointsHeader);

      // Should not throw error
      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination when more than 50 items', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Should have pagination buttons
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('does not show pagination for small datasets', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Scottie Scheffler')).toBeInTheDocument();
      });

      // Should not have page 2 button
      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    });

    it('navigates to next page', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Click page 2
      const page2Button = screen.getByRole('button', { name: '2' });
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Player 51')).toBeInTheDocument();
        expect(screen.queryByText('Player 1')).not.toBeInTheDocument();
      });
    });

    it('navigates to first page', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Go to page 2
      const page2Button = screen.getByRole('button', { name: '2' });
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Player 51')).toBeInTheDocument();
      });

      // Click first page button (the << button)
      const buttons = screen.getAllByRole('button');
      const firstPageButton = buttons[0]; // First button is the << button
      fireEvent.click(firstPageButton);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });
    });

    it('navigates to last page', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Click last page button (the >> button)
      const buttons = screen.getAllByRole('button');
      const lastPageButton = buttons[buttons.length - 1];
      fireEvent.click(lastPageButton);

      await waitFor(() => {
        expect(screen.getByText('Player 100')).toBeInTheDocument();
      });
    });

    it('disables first/prev buttons on first page', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      // First two buttons should be disabled (first page and prev)
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    it('disables next/last buttons on last page', async () => {
      const manyRankings = createManyRankings(100);

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Navigate to last page
      const buttons = screen.getAllByRole('button');
      const lastPageButton = buttons[buttons.length - 1];
      fireEvent.click(lastPageButton);

      await waitFor(() => {
        const updatedButtons = screen.getAllByRole('button');
        // Last two buttons should be disabled (next and last)
        expect(updatedButtons[updatedButtons.length - 1]).toBeDisabled();
        expect(updatedButtons[updatedButtons.length - 2]).toBeDisabled();
      });
    });

    it('shows ellipsis for many pages', async () => {
      const manyRankings = createManyRankings(500); // 10 pages

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: manyRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument();
      });

      // Should show ellipsis
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  describe('getSafeNumber Helper', () => {
    it('handles $numberInt format', async () => {
      const rankingWithNumberInt = {
        id: '1',
        rank: { '$numberInt': '1' },
        fullName: 'Test Player',
        country: 'USA',
        year: { '$numberInt': '2024' },
        points: { '$numberInt': '100' },
        rankingChange: '0',
      };

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: [{ id: '1', data: () => rankingWithNumberInt }],
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('handles $numberDouble format', async () => {
      const rankingWithNumberDouble = {
        id: '1',
        rank: 1,
        fullName: 'Test Player',
        country: 'USA',
        year: 2024,
        points: { '$numberDouble': '12.5678' },
        rankingChange: '0',
      };

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: [{ id: '1', data: () => rankingWithNumberDouble }],
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('12.5678')).toBeInTheDocument();
      });
    });

    it('handles null/undefined values', async () => {
      const rankingWithNull = {
        id: '1',
        rank: null,
        fullName: 'Test Player',
        country: 'USA',
        year: 2024,
        points: undefined,
        rankingChange: '0',
      };

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: [{ id: '1', data: () => rankingWithNull }],
      } as any);

      renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });
    });
  });

  describe('Year Changes', () => {
    it('refetches data when year changes', async () => {
      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockRankings.map(r => ({ id: r.id, data: () => r })),
      } as any);

      const { rerender } = renderWithProvider(<RankingsPage />);

      await waitFor(() => {
        expect(firestore.getDocs).toHaveBeenCalled();
      });

      // Change year in localStorage and rerender
      localStorage.setItem('selectedYear', '2023');

      rerender(
        <YearProvider>
          <RankingsPage />
        </YearProvider>
      );

      // Should fetch again for new year
      await waitFor(() => {
        expect(firestore.getDocs).toHaveBeenCalledTimes(2);
      });
    });
  });
});
