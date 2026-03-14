import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { YearProvider, useYear } from './YearContext';
import React from 'react';

// Test component that uses the hook
const TestConsumer: React.FC = () => {
  const { year, setYear, availableYears } = useYear();
  return (
    <div>
      <span data-testid="year">{year}</span>
      <span data-testid="available-years">{availableYears.join(',')}</span>
      <button onClick={() => setYear(2024)} data-testid="set-2024">Set 2024</button>
      <button onClick={() => setYear(2020)} data-testid="set-invalid">Set Invalid</button>
    </div>
  );
};

describe('YearContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('YearProvider', () => {
    it('provides default year based on current year', () => {
      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      const yearElement = screen.getByTestId('year');
      const currentYear = new Date().getFullYear();
      // Should be current year if in available range, otherwise 2026
      const expectedYear = [2026, 2025, 2024, 2023, 2022, 2021].includes(currentYear)
        ? currentYear
        : 2026;
      expect(yearElement.textContent).toBe(expectedYear.toString());
    });

    it('provides available years', () => {
      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      const availableYears = screen.getByTestId('available-years');
      expect(availableYears.textContent).toBe('2026,2025,2024,2023,2022,2021');
    });

    it('loads year from localStorage if valid', () => {
      localStorage.setItem('selectedYear', '2023');

      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      expect(screen.getByTestId('year').textContent).toBe('2023');
    });

    it('ignores invalid year from localStorage', () => {
      localStorage.setItem('selectedYear', '2015');

      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      // Should fall back to current year or 2026
      const currentYear = new Date().getFullYear();
      const expectedYear = [2026, 2025, 2024, 2023, 2022, 2021].includes(currentYear)
        ? currentYear
        : 2026;
      expect(screen.getByTestId('year').textContent).toBe(expectedYear.toString());
    });

    it('allows setting a valid year', () => {
      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      act(() => {
        screen.getByTestId('set-2024').click();
      });

      expect(screen.getByTestId('year').textContent).toBe('2024');
    });

    it('prevents setting an invalid year', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      const initialYear = screen.getByTestId('year').textContent;

      act(() => {
        screen.getByTestId('set-invalid').click();
      });

      // Year should not change
      expect(screen.getByTestId('year').textContent).toBe(initialYear);
      expect(consoleSpy).toHaveBeenCalledWith('Year 2020 is not in available years');
    });

    it('persists year to localStorage when changed', () => {
      render(
        <YearProvider>
          <TestConsumer />
        </YearProvider>
      );

      act(() => {
        screen.getByTestId('set-2024').click();
      });

      expect(localStorage.setItem).toHaveBeenCalledWith('selectedYear', '2024');
    });
  });

  describe('useYear hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useYear must be used within a YearProvider');

      consoleError.mockRestore();
    });
  });
});
