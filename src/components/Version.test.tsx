import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Version from './Version';
import React from 'react';

// Mock the global constants
vi.stubGlobal('__APP_VERSION__', '1.0.0');
vi.stubGlobal('__BUILD_TIME__', '2024-01-15T10:30:00.000Z');

describe('Version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders version number', () => {
      render(<Version />);
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Version className="custom-class" />);
      const container = screen.getByText('v1.0.0').closest('div');
      expect(container).toHaveClass('custom-class');
    });

    it('does not show build time by default', () => {
      render(<Version />);
      expect(screen.queryByText(/Built:/)).not.toBeInTheDocument();
    });

    it('shows build time when showBuildTime is true', () => {
      render(<Version showBuildTime={true} />);
      expect(screen.getByText(/Built:/)).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('toggles build details on click', () => {
      render(<Version />);

      // Initially no build time shown
      expect(screen.queryByText(/Built:/)).not.toBeInTheDocument();

      // Click to show
      fireEvent.click(screen.getByText('v1.0.0'));
      expect(screen.getByText(/Built:/)).toBeInTheDocument();

      // Click to hide
      fireEvent.click(screen.getByText('v1.0.0'));
      expect(screen.queryByText(/Built:/)).not.toBeInTheDocument();
    });

    it('formats build time correctly', () => {
      render(<Version showBuildTime={true} />);

      // Should contain formatted date
      const buildText = screen.getByText(/Built:/);
      expect(buildText).toBeInTheDocument();
      // The formatted date should include parts like "Jan", "15", "2024"
      expect(buildText.textContent).toMatch(/Jan/);
    });
  });

  describe('Accessibility', () => {
    it('has title attribute on button', () => {
      render(<Version />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Click for build details');
    });
  });
});
