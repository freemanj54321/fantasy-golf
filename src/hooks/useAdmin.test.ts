import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useAdmin from './useAdmin';

// Store mock function reference
let mockOnAuthStateChanged: Mock;

// Mock firebase auth with onAuthStateChanged
vi.mock('firebase/auth', () => {
  mockOnAuthStateChanged = vi.fn((_auth: unknown, callback: (user: unknown) => void) => {
    // Call with null user by default
    callback(null);
    return vi.fn(); // Return unsubscribe function
  });
  return {
    onAuthStateChanged: mockOnAuthStateChanged,
  };
});

vi.mock('../firebase', () => ({
  auth: {},
}));

describe('useAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isAdmin false and loading false when no user is logged in', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn();
    });

    const { result } = renderHook(() => useAdmin());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns isAdmin false when user has no admin claim', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback({
        getIdTokenResult: vi.fn().mockResolvedValue({
          claims: {},
        }),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useAdmin());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns isAdmin true when user has admin claim', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback({
        getIdTokenResult: vi.fn().mockResolvedValue({
          claims: { admin: true },
        }),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useAdmin());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles errors gracefully', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback({
        getIdTokenResult: vi.fn().mockRejectedValue(new Error('Token error')),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useAdmin());

    // Should not throw and return isAdmin false
    await waitFor(() => {
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });
});
